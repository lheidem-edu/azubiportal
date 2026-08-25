/**
 * Gemeinsame Begriffe für beide Personengruppen: Auszubildende und die feste
 * Zentrale-Besetzung. Abwesenheiten werden für beide gleich erfasst, nur die
 * Wirkung auf den Plan unterscheidet sich.
 */

export type PersonKind = "APPRENTICE" | "DESK";

export type PersonOption = {
  /** Zusammengesetzter Wert für Auswahlfelder, z.B. "APPRENTICE:<uuid>". */
  value: string;
  kind: PersonKind;
  id: string;
  name: string;
};

export type AbsenceRow = {
  id: string;
  personKind: PersonKind;
  personId: string;
  personName: string;
  type: string;
  dayPart: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

export function personValue(kind: PersonKind, id: string) {
  return `${kind}:${id}`;
}

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  APPRENTICE: "Auszubildende:r",
  DESK: "Zentrale",
};
