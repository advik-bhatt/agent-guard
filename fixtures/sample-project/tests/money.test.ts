import { formatPrice } from "../src/money";
import { cartSummary } from "../src/cart";
import { receiptLine } from "../src/checkout";

// Amounts are in CENTS across the codebase.
export const tests = {
  "formatPrice formats cents as dollars": () => formatPrice(1999) === "$19.99",
  "cartSummary totals cents": () =>
    cartSummary([{ name: "Widget", priceCents: 1999, qty: 2 }], 0) === "Total: $39.98",
  "receiptLine formats cents": () => receiptLine("Tax", 250) === "Tax: $2.50",
};
