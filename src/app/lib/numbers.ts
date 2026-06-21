const numberFormat = new Intl.NumberFormat()

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}
