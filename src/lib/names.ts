/**
 * Namen zerlegen.
 *
 * Personen werden häufig als „Nachname, Vorname" erfasst – das sortiert sich
 * sauber und ist in Verzeichnissen üblich. Wer einfach am ersten Leerzeichen
 * abschneidet, grüßt dann aber mit „Hallo Heidemann,". Deshalb werden beide
 * Schreibweisen hier an einer Stelle verstanden:
 *
 *   „Heidemann, Luca"  →  Vorname Luca, Nachname Heidemann
 *   „Luca Heidemann"   →  Vorname Luca, Nachname Heidemann
 *
 * Die erfasste Schreibweise bleibt unangetastet; abgeleitet werden nur die
 * Teile, die für Anrede, Kürzel und enge Spalten gebraucht werden.
 */

export type ParsedName = {
  /** Alle Vornamen, wie erfasst. */
  given: string;
  /** Nachname, gegebenenfalls mehrteilig („von der Heide"). */
  family: string;
};

/**
 * Aus einer Anmeldekennung einen brauchbaren Namen bilden – „luca.heidemann"
 * oder „luca.heidemann@firma.de" ergeben beide Luca Heidemann.
 */
function fromHandle(value: string): ParsedName {
  const local = value.includes("@") ? value.slice(0, value.indexOf("@")) : value;
  const parts = local.split(/[._-]+/).filter(Boolean).map(capitalize);
  return { given: parts[0] ?? local, family: parts.slice(1).join(" ") };
}

/** Ein einzelnes Wort mit Punkt oder Unterstrich ist eine Kennung, kein Name. */
function looksLikeHandle(value: string): boolean {
  return !value.includes(" ") && !value.includes(",") && /[._]/.test(value);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function parseName(value: string | null | undefined): ParsedName {
  const name = (value ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { given: "", family: "" };
  if (name.includes("@") || looksLikeHandle(name)) return fromHandle(name);

  const comma = name.indexOf(",");
  if (comma > 0) {
    return {
      given: name.slice(comma + 1).trim(),
      family: name.slice(0, comma).trim(),
    };
  }

  const parts = name.split(" ");
  if (parts.length === 1) return { given: parts[0], family: "" };
  return { given: parts[0], family: parts.slice(1).join(" ") };
}

/** Der erste Vorname – für die Anrede. */
export function firstName(value: string | null | undefined): string {
  const { given, family } = parseName(value);
  return given.split(" ")[0] || family || "";
}

/**
 * Kurzform für enge Spalten: erster Vorname, bei Bedarf mit dem
 * Anfangsbuchstaben des Nachnamens, damit gleiche Vornamen unterscheidbar
 * bleiben.
 */
export function compactName(
  value: string | null | undefined,
  options: { withFamilyInitial?: boolean } = {},
): string {
  const { given, family } = parseName(value);
  const first = given.split(" ")[0] || family;
  if (!options.withFamilyInitial || !family) return first;
  return `${first} ${family.charAt(0)}.`;
}

/** Zwei Buchstaben, immer in der Reihenfolge Vorname, Nachname. */
export function initials(value: string | null | undefined): string {
  const { given, family } = parseName(value);
  const first = given.charAt(0);
  // Beim Nachnamen zählt das letzte Wort, damit Zusätze wie „von der“
  // übersprungen werden: „von der Heide“ → „H“.
  const last = (family.split(" ").filter(Boolean).at(-1) ?? "").charAt(0);
  if (first && last) return `${first}${last}`.toUpperCase();

  // Nur ein Namensteil vorhanden – dann dessen erste zwei Buchstaben.
  const single = given || family;
  return single ? single.slice(0, 2).toUpperCase() : "?";
}

/** „Vorname Nachname" – für Stellen, an denen die Anredeform passt. */
export function fullName(value: string | null | undefined): string {
  const { given, family } = parseName(value);
  return [given, family].filter(Boolean).join(" ");
}
