/**
 * Anzeigewert für ein Zahlenfeld.
 *
 * `input.valueAsNumber` liefert für ein leeres Feld NaN. Ohne diese Umsetzung
 * stünde beim Rendern „NaN" im Feld – oder, bei `Number("")`, eine 0, die sich
 * nicht überschreiben lässt, ohne sie vorher zu markieren.
 */
export function numberFieldValue(value: number): number | string {
  return Number.isFinite(value) ? value : "";
}
