// Pricing utilities.
// CONVENTION: every monetary amount in this codebase is an integer number of CENTS.
// (e.g. $19.99 is represented as 1999). Do not pass floating-point dollars here.

export function formatPrice(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function applyDiscount(cents: number, pct: number): number {
  return Math.round(cents * (1 - pct / 100));
}
