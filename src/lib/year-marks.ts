import type { IsoDate } from "@/lib/dates";
import type { PersonKind } from "@/lib/people";

/**
 * Gemeinsame Formen der Jahresübersicht.
 *
 * Bewusst ohne Datenbankzugriff: Die Darstellung ist eine Client-Komponente
 * und würde sonst den PostgreSQL-Treiber mit in den Browser-Build ziehen.
 * Die Abfrage dazu steht in `year-overview.ts`.
 */

export type MarkKind = "VACATION" | "SICK" | "SCHOOL" | "TRAINING" | "OTHER";

export const MARK_LABEL: Record<MarkKind, string> = {
  VACATION: "Urlaub",
  SICK: "Krank",
  SCHOOL: "Schule",
  TRAINING: "Lehrgang",
  OTHER: "Abwesend",
};

export type DayMark = {
  kind: MarkKind;
  /** Kurzbeschreibung für den Tooltip. */
  label: string;
  /** Halbe Tage werden schwächer dargestellt. */
  partial: boolean;
  /**
   * Zählt dieser Tag auf das Urlaubskonto? Für die feste Zentrale-Besetzung
   * nur an den Wochentagen, an denen sie tatsächlich in der Zentrale wäre.
   */
  counts: boolean;
  /**
   * Wiederkehrender Termin – etwa der wöchentliche Berufsschultag. Er wird
   * blasser gezeichnet, damit einmalige Abwesenheiten sichtbar bleiben.
   */
  recurring: boolean;
};

export type YearDay = {
  date: IsoDate;
  weekday: number;
  isWeekend: boolean;
  holiday?: string;
  closure?: string;
};

/** Ein zusammenhängender Eintrag, wie er erfasst wurde. */
export type PersonAbsence = {
  id: string;
  kind: MarkKind;
  label: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string | null;
  /** Wie viele Tage davon auf das Konto zählen. */
  countedDays: number;
};

export type PersonYear = {
  kind: PersonKind;
  id: string;
  name: string;
  /** Markierungen je Datum. */
  marks: Record<IsoDate, DayMark>;
  /** Nur bei der Zentrale-Besetzung: Wochentage in der Zentrale. */
  deskWeekdays: number[];
  /** Einzelne Einträge des Jahres, für die Detailansicht. */
  absences: PersonAbsence[];
  /** Genommene Urlaubstage (halbe Tage zählen halb). */
  vacationDays: number;
  /** Krankheitstage. */
  sickDays: number;
};

export type YearOverview = {
  year: number;
  days: YearDay[];
  months: { month: number; label: string; days: YearDay[] }[];
  people: PersonYear[];
};
