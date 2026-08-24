import { and, gte, isNotNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { absences, apprentices, deskStaff, schoolTerms } from "@/db/schema";
import { eachDay, isoWeekday, type IsoDate } from "@/lib/dates";
import { listClosures, listEffectiveHolidays } from "@/lib/calendar";
import { isSchoolDay } from "@/lib/scheduler/availability";
import type { PersonKind } from "@/lib/people";

/**
 * Jahresübersicht: wer ist wann nicht da.
 *
 * Zusammengetragen werden Urlaub, Krankmeldungen und sonstige Abwesenheiten
 * beider Personengruppen sowie – bei Auszubildenden – die wiederkehrenden
 * Berufsschultage. Feiertage und Betriebsferien kommen als Hintergrund dazu.
 */

export type MarkKind = "VACATION" | "SICK" | "SCHOOL" | "TRAINING" | "OTHER";

export type DayMark = {
  kind: MarkKind;
  /** Kurzbeschreibung für den Tooltip. */
  label: string;
  /** Halbe Tage werden schwächer dargestellt. */
  partial: boolean;
  /** Noch nicht genehmigter Antrag. */
  pending: boolean;
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

export type PersonYear = {
  kind: PersonKind;
  id: string;
  name: string;
  /** Markierungen je Datum. */
  marks: Record<IsoDate, DayMark>;
  /** Genommene Urlaubstage (nur Arbeitstage, halbe Tage zählen halb). */
  vacationDays: number;
  /** Krankheitstage (nur Arbeitstage). */
  sickDays: number;
};

export type YearOverview = {
  year: number;
  days: YearDay[];
  months: { month: number; label: string; days: YearDay[] }[];
  people: PersonYear[];
};

const MONTH_LABELS = [
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

const ABSENCE_MARK: Record<string, MarkKind> = {
  VACATION: "VACATION",
  SICK: "SICK",
  SCHOOL_BLOCK: "SCHOOL",
  TRAINING: "TRAINING",
  OTHER: "OTHER",
};

export const MARK_LABEL: Record<MarkKind, string> = {
  VACATION: "Urlaub",
  SICK: "Krank",
  SCHOOL: "Schule",
  TRAINING: "Lehrgang",
  OTHER: "Abwesend",
};

export async function getYearOverview(year: number): Promise<YearOverview> {
  const from: IsoDate = `${year}-01-01`;
  const to: IsoDate = `${year}-12-31`;

  const [apprenticeRows, staffRows, absenceRows, schoolRows, holidays, closures] =
    await Promise.all([
      db
        .select({ id: apprentices.id, name: apprentices.displayName })
        .from(apprentices)
        .orderBy(apprentices.displayName),
      db
        .select({ id: deskStaff.id, name: deskStaff.name })
        .from(deskStaff)
        .orderBy(deskStaff.name),
      db
        .select()
        .from(absences)
        .where(
          and(
            ne(absences.status, "REJECTED"),
            ne(absences.status, "CANCELLED"),
            lte(absences.startDate, to),
            gte(absences.endDate, from),
            or(isNotNull(absences.apprenticeId), isNotNull(absences.deskStaffId)),
          ),
        ),
      db.select().from(schoolTerms).where(lte(schoolTerms.validFrom, to)),
      listEffectiveHolidays(from, to),
      listClosures(),
    ]);

  const holidayByDate = new Map(
    holidays.filter((h) => h.isActive).map((h) => [h.date, h.name] as const),
  );

  const days: YearDay[] = eachDay(from, to).map((date) => {
    const weekday = isoWeekday(date);
    const closure = closures.find((c) => date >= c.startDate && date <= c.endDate);
    return {
      date,
      weekday,
      isWeekend: weekday >= 6,
      holiday: holidayByDate.get(date),
      closure: closure?.name,
    };
  });

  const schoolByApprentice = new Map<string, typeof schoolRows>();
  for (const term of schoolRows) {
    const list = schoolByApprentice.get(term.apprenticeId) ?? [];
    list.push(term);
    schoolByApprentice.set(term.apprenticeId, list);
  }

  const people: PersonYear[] = [
    ...apprenticeRows.map((row) => ({ kind: "APPRENTICE" as const, id: row.id, name: row.name })),
    ...staffRows.map((row) => ({ kind: "DESK" as const, id: row.id, name: row.name })),
  ].map((person) => {
    const marks: Record<IsoDate, DayMark> = {};

    // Wiederkehrende Berufsschultage zuerst – konkrete Abwesenheiten
    // überschreiben sie anschließend.
    if (person.kind === "APPRENTICE") {
      const terms = schoolByApprentice.get(person.id);
      if (terms?.length) {
        for (const day of days) {
          if (day.isWeekend || day.holiday) continue;
          if (isSchoolDay(terms, day.date)) {
            marks[day.date] = {
              kind: "SCHOOL",
              label: "Berufsschule",
              partial: false,
              pending: false,
              recurring: true,
            };
          }
        }
      }
    }

    const own = absenceRows.filter((entry) =>
      person.kind === "APPRENTICE"
        ? entry.apprenticeId === person.id
        : entry.deskStaffId === person.id,
    );

    let vacationDays = 0;
    let sickDays = 0;

    for (const entry of own) {
      const kind = ABSENCE_MARK[entry.type] ?? "OTHER";
      const partial = entry.dayPart !== "FULL";
      const pending = entry.status === "PENDING";
      const label = `${MARK_LABEL[kind]}${partial ? " (halber Tag)" : ""}${pending ? " – offen" : ""}`;

      for (const date of eachDay(
        entry.startDate < from ? from : entry.startDate,
        entry.endDate > to ? to : entry.endDate,
      )) {
        const day = days.find((d) => d.date === date);
        if (!day) continue;
        marks[date] = { kind, label, partial, pending, recurring: false };
        if (day.isWeekend || day.holiday) continue;
        if (kind === "VACATION") vacationDays += partial ? 0.5 : 1;
        if (kind === "SICK") sickDays += partial ? 0.5 : 1;
      }
    }

    return { ...person, marks, vacationDays, sickDays };
  });

  const months = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    days: days.filter((day) => Number(day.date.slice(5, 7)) === index + 1),
  }));

  return { year, days, months, people };
}

/** Zusätzlich zu den Personen sortiert: Auszubildende zuerst, dann Zentrale. */
export function sortPeople(people: PersonYear[]): PersonYear[] {
  return [...people].sort(
    (a, b) =>
      Number(a.kind === "DESK") - Number(b.kind === "DESK") || a.name.localeCompare(b.name, "de"),
  );
}
