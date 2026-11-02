/** Money formatting (R2): one place. Currency is a Hotel info setting (default USD). */
export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
/** Plain form for report text (no thousands separators, so number checking stays simple). */
export function formatMoneyPlain(amount: number, currency = "USD"): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${currency} ${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)}`;
}
