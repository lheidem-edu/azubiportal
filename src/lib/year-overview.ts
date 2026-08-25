import { and, gte, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { absences, apprentices, deskShifts, deskStaff, schoolTerms } from "@/db/schema";
import { eachDay, isoWeekday, type IsoDate } from "@/lib/dates";
import { listClosures, listEffectiveHolidays, listSchoolHolidays } from "@/lib/calendar";
import { isSchoolDay } from "@/lib/scheduler/availability";
import {
  MARK_LABEL,
  type DayMark,
  type MarkKind,
  type PersonAbsence,
  type PersonYear,
  type YearDay,
  type YearOverview,
} from "@/lib/year-marks";

export * from "@/lib/year-marks";

/**
 * Jahresübersicht: wer ist wann nicht da.
 *
 * Zusammengetragen werden Urlaub, Krankmeldungen und sonstige Abwesenheiten
 * beider Personengruppen sowie – bei Auszubildenden – die wiederkehrenden
 * Berufsschultage. Feiertage und Betriebsferien kommen als Hintergrund dazu.
 */

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

export async function getYearOverview(year: number): Promise<YearOverview> {
  const from: IsoDate = `${year}-01-01`;
  const to: IsoDate = `${year}-12-31`;

  const [
    apprenticeRows,
    staffRows,
    absenceRows,
    schoolRows,
    shiftRows,
    holidays,
    closures,
    schoolHolidayRows,
  ] = await Promise.all([
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
            lte(absences.startDate, to),
            gte(absences.endDate, from),
            or(isNotNull(absences.apprenticeId), isNotNull(absences.deskStaffId)),
          ),
        ),
      db.select().from(schoolTerms).where(lte(schoolTerms.validFrom, to)),
      db.select().from(deskShifts).where(lte(deskShifts.validFrom, to)),
      listEffectiveHolidays(from, to),
      listClosures(),
      listSchoolHolidays(from, to),
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

  const shiftsByStaff = new Map<string, typeof shiftRows>();
  for (const shift of shiftRows) {
    const list = shiftsByStaff.get(shift.staffId) ?? [];
    list.push(shift);
    shiftsByStaff.set(shift.staffId, list);
  }

  const people: PersonYear[] = [
    ...apprenticeRows.map((row) => ({ kind: "APPRENTICE" as const, id: row.id, name: row.name })),
    ...staffRows.map((row) => ({ kind: "DESK" as const, id: row.id, name: row.name })),
  ].map((person) => {
    const marks: Record<IsoDate, DayMark> = {};
    const shifts = person.kind === "DESK" ? (shiftsByStaff.get(person.id) ?? []) : [];
    const deskWeekdays = [...new Set(shifts.map((s) => s.weekday))].sort();

    /**
     * An welchen Tagen wäre die Person überhaupt da? Auszubildende an jedem
     * Arbeitstag, die Zentrale-Besetzung nur an ihren Wochentagen – ein
     * Urlaubstag am Donnerstag kostet jemanden mit Dienst Mo–Mi nichts.
     */
    const wouldBePresent = (day: YearDay) => {
      if (day.isWeekend || day.holiday || day.closure) return false;
      if (person.kind !== "DESK") return true;
      return shifts.some(
        (shift) =>
          shift.weekday === day.weekday &&
          day.date >= shift.validFrom &&
          (!shift.validTo || day.date <= shift.validTo),
      );
    };

    // Wiederkehrende Berufsschultage zuerst – konkrete Abwesenheiten
    // überschreiben sie anschließend.
    if (person.kind === "APPRENTICE") {
      const terms = schoolByApprentice.get(person.id);
      if (terms?.length) {
        for (const day of days) {
          if (day.isWeekend || day.holiday) continue;
          if (isSchoolDay(terms, day.date, schoolHolidayRows)) {
            marks[day.date] = {
              kind: "SCHOOL",
              label: "Berufsschule",
              partial: false,
              counts: false,
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

    const dayByDate = new Map(days.map((day) => [day.date, day]));
    const personAbsences: PersonAbsence[] = [];
    let vacationDays = 0;
    let sickDays = 0;

    for (const entry of own) {
      const kind = ABSENCE_MARK[entry.type] ?? "OTHER";
      const partial = entry.dayPart !== "FULL";
      const label = `${MARK_LABEL[kind]}${partial ? " (halber Tag)" : ""}`;
      const startDate = entry.startDate < from ? from : entry.startDate;
      const endDate = entry.endDate > to ? to : entry.endDate;
      let countedDays = 0;

      for (const date of eachDay(startDate, endDate)) {
        const day = dayByDate.get(date);
        if (!day) continue;
        const counts = wouldBePresent(day);
        marks[date] = { kind, label, partial, counts, recurring: false };
        if (!counts) continue;
        countedDays += partial ? 0.5 : 1;
        if (kind === "VACATION") vacationDays += partial ? 0.5 : 1;
        if (kind === "SICK") sickDays += partial ? 0.5 : 1;
      }

      personAbsences.push({
        id: entry.id,
        kind,
        label: MARK_LABEL[kind],
        startDate,
        endDate,
        reason: entry.reason,
        countedDays,
      });
    }

    personAbsences.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      ...person,
      marks,
      deskWeekdays,
      absences: personAbsences,
      vacationDays,
      sickDays,
    };
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
