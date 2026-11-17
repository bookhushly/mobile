export function formatNaira(amount: number): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const [whole = '0', frac] = abs.toFixed(Number.isInteger(abs) ? 0 : 2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}₦${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}
