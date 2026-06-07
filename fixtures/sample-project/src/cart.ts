import { formatPrice, applyDiscount } from "./money";

export interface LineItem {
  name: string;
  priceCents: number; // cents, per the codebase convention
  qty: number;
}

export function cartSubtotalCents(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
}

export function cartSummary(items: LineItem[], discountPct: number): string {
  const subtotal = cartSubtotalCents(items);
  const total = applyDiscount(subtotal, discountPct);
  // formatPrice is called with CENTS here.
  return `Total: ${formatPrice(total)}`;
}
