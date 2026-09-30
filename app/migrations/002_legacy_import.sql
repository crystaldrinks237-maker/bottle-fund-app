-- Copies prototype data (parked as legacy_* by 001) into the new model. No-op on a fresh database.
-- Legacy tables are left untouched afterwards so nothing is lost; drop them yourself once satisfied.
DO $$
BEGIN
  IF to_regclass('public.legacy_weeks') IS NULL THEN RETURN; END IF;

  -- referrers who already have an account become guarantors
  UPDATE users u SET roles = array_append(u.roles, 'GUARANTOR')
   WHERE NOT ('GUARANTOR' = ANY(u.roles))
     AND EXISTS (SELECT 1 FROM legacy_investments li WHERE lower(li.referrer_username) = lower(u.username));

  -- weeks -> funding needs
  INSERT INTO funding_needs (title, product, description, quantity, cost_price, sell_price, op_cost, investor_pct, guarantor_pct,
                             total_capital, funded_amount, status, created_by, created_at, opened_at, closed_at, legacy_week_id)
  SELECT 'Week #' || w.id || ' – ' || w.quality, w.quality, 'Imported from the original weekly prototype.',
         round(w.qty)::bigint, round(w.cost_price,2), round(w.sell_price,2), round(w.op_cost,2),
         round(w.investor_pct,2), round(w.guarantor_pct,2),
         round(w.qty * w.cost_price, 2),
         COALESCE((SELECT round(sum(li.amount),2) FROM legacy_investments li WHERE li.week_id = w.id), 0),
         CASE WHEN w.status = 'open' THEN 'OPEN' ELSE 'CLOSED' END,
         w.created_by, w.created_at, w.created_at,
         CASE WHEN w.status = 'open' THEN NULL ELSE now() END, w.id
    FROM legacy_weeks w;

  -- payment screenshots (base64 data URLs) -> payment_proofs
  INSERT INTO payment_proofs (uploader_id, mime_type, size_bytes, sha256, original_name, data, created_at, legacy_id)
  SELECT li.investor_id,
         COALESCE(substring(li.proof_data from 'data:([^;]+);'), 'image/jpeg'),
         octet_length(decode(split_part(li.proof_data, ',', 2), 'base64')),
         md5(li.proof_data),
         'legacy-proof-' || li.id,
         decode(split_part(li.proof_data, ',', 2), 'base64'),
         li.created_at, li.id
    FROM legacy_investments li
   WHERE li.proof_data IS NOT NULL AND li.proof_data LIKE 'data:%;base64,%'
     AND octet_length(decode(split_part(li.proof_data, ',', 2), 'base64')) > 0;

  -- investments (pricing inputs frozen from the week; results frozen for verified rows)
  INSERT INTO investments (funding_need_id, investor_id, guarantor_id, legacy_referrer_username, amount, status, proof_id,
                           snap_title, snap_product, snap_cost_price, snap_sell_price, snap_op_cost, snap_investor_pct, snap_guarantor_pct,
                           expected_investor_profit, expected_total_return, guarantor_profit, business_profit,
                           created_at, verified_at, due_at, legacy_id, is_legacy)
  SELECT fn.id, li.investor_id,
         (SELECT g.id FROM users g WHERE lower(g.username) = lower(li.referrer_username)),
         li.referrer_username,
         round(li.amount,2),
         CASE WHEN li.returned THEN 'COMPLETED' WHEN li.verified THEN 'VERIFIED' ELSE 'PENDING_VERIFICATION' END,
         (SELECT p.id FROM payment_proofs p WHERE p.legacy_id = li.id),
         fn.title, fn.product, fn.cost_price, fn.sell_price, fn.op_cost, fn.investor_pct, fn.guarantor_pct,
         CASE WHEN li.verified THEN round(li.amount * (fn.sell_price - fn.cost_price - fn.op_cost) * fn.investor_pct / (fn.cost_price * 100), 2) END,
         CASE WHEN li.verified THEN round(li.amount + li.amount * (fn.sell_price - fn.cost_price - fn.op_cost) * fn.investor_pct / (fn.cost_price * 100), 2) END,
         CASE WHEN li.verified THEN round(li.amount * (fn.sell_price - fn.cost_price - fn.op_cost) * fn.guarantor_pct / (fn.cost_price * 100), 2) END,
         CASE WHEN li.verified THEN round(li.amount * (fn.sell_price - fn.cost_price - fn.op_cost) * fn.business_pct / (fn.cost_price * 100), 2) END,
         li.created_at,
         CASE WHEN li.verified THEN COALESCE(li.verified_at, li.created_at) END,
         CASE WHEN li.verified THEN COALESCE(li.verified_at, li.created_at) + interval '168 hours' END,
         li.id, true
    FROM legacy_investments li
    JOIN funding_needs fn ON fn.legacy_week_id = li.week_id;

  -- payouts for every verified legacy investment
  INSERT INTO payouts (investment_id, investor_id, amount, principal, profit, status, due_at, paid_at, notes, created_at)
  SELECT i.id, i.investor_id, i.expected_total_return, i.amount, i.expected_investor_profit,
         CASE WHEN li.returned THEN 'PAID' ELSE 'DUE' END, i.due_at,
         CASE WHEN li.returned THEN COALESCE(li.returned_at, now()) END,
         CASE WHEN li.returned THEN 'Imported from prototype: marked returned before transaction IDs were recorded.' END,
         i.verified_at
    FROM investments i JOIN legacy_investments li ON li.id = i.legacy_id
   WHERE i.is_legacy AND i.status IN ('VERIFIED','COMPLETED');

  -- guarantor relationships (first referrer seen per investor)
  INSERT INTO guarantor_relationships (investor_id, guarantor_id)
  SELECT DISTINCT ON (i.investor_id) i.investor_id, i.guarantor_id
    FROM investments i
   WHERE i.is_legacy AND i.guarantor_id IS NOT NULL AND i.guarantor_id <> i.investor_id
   ORDER BY i.investor_id, i.created_at
  ON CONFLICT DO NOTHING;

  -- months the prototype recorded as actually paid -> PAID settlements, with their items linked
  IF to_regclass('public.legacy_guarantor_payouts') IS NOT NULL THEN
    INSERT INTO guarantor_payments (guarantor_id, period_month, amount, status, paid_at, notes, created_at)
    SELECT u.id, lgp.period_month, round(lgp.total_amount,2), 'PAID', lgp.paid_at,
           'Imported from prototype: paid before transaction IDs were recorded.', lgp.created_at
      FROM legacy_guarantor_payouts lgp JOIN users u ON lower(u.username) = lower(lgp.referrer_username)
     WHERE lgp.paid_at IS NOT NULL AND lgp.total_amount > 0
    ON CONFLICT DO NOTHING;

    INSERT INTO guarantor_payment_items (investment_id, guarantor_payment_id, amount)
    SELECT i.id, gp.id, i.guarantor_profit
      FROM investments i
      JOIN guarantor_payments gp ON gp.guarantor_id = i.guarantor_id
           AND gp.period_month = date_trunc('month', i.verified_at)::date
           AND gp.notes LIKE 'Imported from prototype%'
     WHERE i.is_legacy AND i.guarantor_id IS NOT NULL AND i.verified_at IS NOT NULL AND COALESCE(i.guarantor_profit,0) > 0
    ON CONFLICT DO NOTHING;
  END IF;

  -- keep sequences ahead of anything we inserted explicitly (none forced ids, but be safe)
  PERFORM setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT COALESCE(max(id),1) FROM users),1));
END $$;
