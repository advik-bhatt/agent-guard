import { formatPrice } from "./money";

// Renders a single line on a receipt. `amountCents` is in cents.
export function receiptLine(label: string, amountCents: number): string {
  // formatPrice is called with CENTS here too.
  return `${label}: ${formatPrice(amountCents)}`;
}
