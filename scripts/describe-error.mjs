/**
 * Fehler lesbar machen.
 *
 * Verbindungsfehler von Node kommen als `AggregateError` mit leerer `message`
 * an – wer nur `error.message` ausgibt, bekommt eine leere Zeile und weiß
 * nicht, was los ist. Die eigentliche Ursache steckt in `errors`.
 */
export function describeError(error) {
  if (error instanceof AggregateError) {
    const causes = (error.errors ?? [])
      .map((inner) => inner?.message || String(inner))
      .filter(Boolean);
    const unique = [...new Set(causes)];
    if (unique.length > 0) return unique.join("; ");
  }
  if (error instanceof Error) {
    return error.message || `${error.name}${error.code ? ` (${error.code})` : ""}`;
  }
  return String(error);
}
