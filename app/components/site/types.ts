/** Quality labels — exact spelling preserved. Managed in Admin → Website. */
export type Quality = 'Clear' | 'Getron' | 'Mix' | 'Pure';

export interface ConfirmedPrice { price: number; perBottle: string }

export interface Product {
  id: string;
  size: string;
  unit: string;
  label: string;
  /** Only the qualities currently marked available in the admin dashboard. */
  qualities: Quality[];
  defaultQuality: Quality;
  /** Bottles per pack — null when sold individually / to be confirmed. */
  pack: number | null;
  /** Only prices that have been set, keyed by quality. */
  prices: Partial<Record<Quality, ConfirmedPrice>>;
  note?: string;
  image: string;
  imageAlt: string;
}
export interface NavLink { label: string; href: string }
