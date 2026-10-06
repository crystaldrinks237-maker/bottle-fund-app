# Browser smoke test (needs: pip install playwright && playwright install chromium; run after scripts/e2e.mjs so there is data).
# Loads every page for admin / investor / guarantor on desktop and mobile; reports console errors, error screens, horizontal overflow.
import subprocess, json
from playwright.sync_api import sync_playwright
def q(sql): return subprocess.run(['psql','-h','localhost','-U','cd','fresh','-At','-c',sql],env={'PGPASSWORD':'cd','PATH':'/usr/bin'},capture_output=True,text=True).stdout.strip().split('\n')
need_ids=q("SELECT id FROM funding_needs ORDER BY status, id")  # drafts, open, full, ...
statuses=dict(l.split('|') for l in q("SELECT id||'|'||status FROM funding_needs"))
open_id=[i for i in need_ids if statuses[i]=='OPEN'][0]
inv=q("SELECT id FROM investments ORDER BY id DESC LIMIT 1")[0]
users={'admin':('admin','admin-password-1')}
for role,prefix in [('investor','inv1%'),('guarantor','guar1%')]:
    u=q(f"SELECT username FROM users WHERE username LIKE '{prefix}' LIMIT 1")[0]; users[role]=(u,'password-12345')
routes={
 'admin':['/admin','/admin/funding-needs']+[f'/admin/funding-needs/{i}' for i in need_ids]+['/admin/investments',f'/admin/investments/{inv}','/admin/payment-accounts','/admin/investors','/admin/guarantors','/admin/payouts','/admin/guarantor-payments','/admin/claims','/admin/testimonials','/admin/activity','/admin/settings','/dashboard','/investments',f'/investments/{inv}','/funding-needs',f'/funding-needs/{open_id}','/payouts','/profile','/guarantor','/guarantor/payments','/notifications'],
 'investor':['/dashboard','/investments','/funding-needs',f'/funding-needs/{open_id}','/payouts','/profile','/notifications','/guarantor','/guarantor/payments'],
 'guarantor':['/guarantor','/guarantor/payments','/profile','/notifications'],
}
problems=[]; visited=0
with sync_playwright() as p:
    b=p.chromium.launch()
    for role,(u,pw) in users.items():
        for vp in ([{'width':1366,'height':900}] + ([{'width':390,'height':844}] if role=='admin' else [])):
            ctx=b.new_context(viewport=vp); pg=ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)[:200]))
            pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:200]) if (m.type=='error' and 'RSC payload' not in m.text) else None)
            pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url.replace("http://localhost:3100","")}') if r.status>=400 and '/_next/' not in r.url and r.status!=401 else None)
            pg.goto('http://localhost:3100/login'); pg.fill('input[autocomplete=username]',u); pg.fill('input[autocomplete=current-password]',pw); pg.click('button.btn-primary'); pg.wait_for_url(lambda url: '/login' not in url, timeout=15000)
            for r in routes[role]:
                errs.clear(); pg.goto('http://localhost:3100'+r, wait_until='networkidle'); pg.wait_for_timeout(400)
                body=pg.inner_text('body'); visited+=1
                if 'This page hit a problem' in body or 'Application error' in body: errs.append('ERROR BOUNDARY SHOWN')
                if pg.locator('.errbox').count(): errs.append('errbox: '+pg.locator('.errbox').first.inner_text()[:120])
                if vp['width']<500 and pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2'): errs.append('HORIZONTAL OVERFLOW on mobile')
                if errs: problems.append((role, vp['width'], r, list(errs)))
            if role=='admin' and vp['width']>500:
                for nm,r in [('overview','/admin'),('need-open','/admin/funding-needs/'+next(i for i in need_ids if statuses[i]=='OPEN')),('investments','/admin/investments'),('accounts','/admin/payment-accounts')]:
                    pg.goto('http://localhost:3100'+r, wait_until='networkidle'); pg.wait_for_timeout(500); pg.screenshot(path=f'/tmp/s-{nm}.png')
            if role=='admin' and vp['width']<500:
                pg.goto('http://localhost:3100/admin', wait_until='networkidle'); pg.screenshot(path='/tmp/s-mobile-admin.png')
                pg.goto('http://localhost:3100/admin/investments', wait_until='networkidle'); pg.wait_for_timeout(400); pg.screenshot(path='/tmp/s-mobile-investments.png')
            ctx.close()
    b.close()
print('pages visited:', visited); print('problems:', len(problems))
for pr in problems: print(pr)
