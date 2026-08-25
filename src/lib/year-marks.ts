import type { IsoDate } from "@/lib/dates";
import type { PersonKind } from "@/lib/people";

/**
 * Gemeinsame Formen des Abwesenheitskalenders.
 *
 * Geladen wird jeweils ein ganzes Jahr (`year-overview.ts`); die Anzeige
 * schneidet daraus einen Monat heraus, damit neben den Monatswerten auch die
 * Jahressummen zur Verfügung stehen.
 *
 * Bewusst ohne Datenbankzugriff: Die Darstellung ist eine Client-Komponente
 * und würde sonst den PostgreSQL-Treiber mit in den Browser-Build ziehen.
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
  /** Bezeichnung der Schulferien, falls der Tag hineinfällt. */
  schoolHoliday?: string;
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
  /** Kurzform für enge Kalenderzellen – Kürzel, sonst der Vorname. */
  shortName: string;
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

/* -------------------------------------------------------------------------- */
/* Monatsansicht                                                              */
/* -------------------------------------------------------------------------- */

export type MonthEntry = {
  person: PersonYear;
  mark: DayMark;
};

export type MonthDay = YearDay & {
  /** Wer an diesem Tag nicht da ist. */
  entries: MonthEntry[];
};

export type MonthView = {
  year: number;
  month: number;
  label: string;
  days: MonthDay[];
  /** Leerfelder vor dem Monatsersten, damit der Kalender am Wochentag ausgerichtet ist. */
  leadingBlanks: number;
  people: PersonYear[];
};

export const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Schneidet aus den Jahresdaten einen Monat heraus und hängt an jeden Tag die
 * betroffenen Personen. Die Jahreszahlen bleiben erhalten, damit sich neben
 * dem Monatswert auch der Stand fürs ganze Jahr anzeigen lässt.
 */
export function buildMonthView(overview: YearOverview, month: number): MonthView {
  const days: MonthDay[] = overview.days
    .filter((day) => Number(day.date.slice(5, 7)) === month)
    .map((day) => ({
      ...day,
      entries: overview.people
        .map((person) => ({ person, mark: person.marks[day.date] }))
        .filter((entry): entry is MonthEntry => Boolean(entry.mark)),
    }));

  return {
    year: overview.year,
    month,
    label: MONTH_NAMES[month - 1] ?? "",
    days,
    leadingBlanks: days.length > 0 ? days[0].weekday - 1 : 0,
    people: overview.people,
  };
}

/** Summen einer Person innerhalb eines Monats. */
export function monthTotals(person: PersonYear, days: MonthDay[]) {
  let vacation = 0;
  let sick = 0;
  for (const day of days) {
    const mark = person.marks[day.date];
    if (!mark || !mark.counts) continue;
    const value = mark.partial ? 0.5 : 1;
    if (mark.kind === "VACATION") vacation += value;
    if (mark.kind === "SICK") sick += value;
  }
  return { vacation, sick };
}
