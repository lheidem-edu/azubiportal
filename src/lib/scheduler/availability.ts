import { isoWeekday, weeksBetween, type IsoDate } from "@/lib/dates";
import type {
  SchedulerAbsence,
  SchedulerApprentice,
  SchedulerSchoolTerm,
  SchedulerSlot,
  UnavailabilityReason,
} from "./types";

export type AvailabilityLookup = {
  schoolTermsByApprentice: Map<string, SchedulerSchoolTerm[]>;
  absencesByApprentice: Map<string, SchedulerAbsence[]>;
};

export function buildAvailabilityLookup(
  schoolTerms: SchedulerSchoolTerm[],
  absences: SchedulerAbsence[],
): AvailabilityLookup {
  const schoolTermsByApprentice = new Map<string, SchedulerSchoolTerm[]>();
  for (const term of schoolTerms) {
    const list = schoolTermsByApprentice.get(term.apprenticeId) ?? [];
    list.push(term);
    schoolTermsByApprentice.set(term.apprenticeId, list);
  }
  const absencesByApprentice = new Map<string, SchedulerAbsence[]>();
  for (const absence of absences) {
    const list = absencesByApprentice.get(absence.apprenticeId) ?? [];
    list.push(absence);
    absencesByApprentice.set(absence.apprenticeId, list);
  }
  return { schoolTermsByApprentice, absencesByApprentice };
}

export function isEmployedOn(apprentice: SchedulerApprentice, date: IsoDate): boolean {
  if (date < apprentice.startDate) return false;
  if (apprentice.endDate && date > apprentice.endDate) return false;
  return true;
}

/** Greift an diesem Tag ein wiederkehrender Berufsschultag? */
export function isSchoolDay(terms: SchedulerSchoolTerm[] | undefined, date: IsoDate): boolean {
  if (!terms?.length) return false;
  const weekday = isoWeekday(date);
  return terms.some((term) => {
    if (term.weekday !== weekday) return false;
    if (date < term.validFrom) return false;
    if (term.validTo && date > term.validTo) return false;
    const interval = term.intervalWeeks ?? 1;
    if (interval <= 1) return true;
    const anchor = term.anchorWeek ?? term.validFrom;
    const diff = weeksBetween(anchor, date);
    return ((diff % interval) + interval) % interval === 0;
  });
}

/**
 * Blockiert eine Abwesenheit den konkreten Slot?
 * Halbe Tage blockieren nur die Pausen in der jeweiligen Tageshälfte,
 * eine ganztägige Vertretung aber immer.
 */
export function absenceBlocksSlot(absence: SchedulerAbsence, slot: SchedulerSlot): boolean {
  if (absence.dayPart === "FULL") return true;
  if (slot.kind === "FULL_DAY") return true;
  const startsBeforeNoon = slot.startTime < "12:00";
  return absence.dayPart === "MORNING" ? startsBeforeNoon : !startsBeforeNoon;
}

export type AvailabilityCheck =
  | { available: true }
  | { available: false; reason: UnavailabilityReason; detail?: string };

export function checkAvailability(
  apprentice: SchedulerApprentice,
  date: IsoDate,
  slot: SchedulerSlot,
  lookup: AvailabilityLookup,
): AvailabilityCheck {
  if (!apprentice.isPlannable) return { available: false, reason: "NOT_PLANNABLE" };
  if (!isEmployedOn(apprentice, date)) return { available: false, reason: "NOT_EMPLOYED" };
  if (isSchoolDay(lookup.schoolTermsByApprentice.get(apprentice.id), date)) {
    return { available: false, reason: "SCHOOL" };
  }
  const absences = lookup.absencesByApprentice.get(apprentice.id) ?? [];
  for (const absence of absences) {
    if (date < absence.startDate || date > absence.endDate) continue;
    if (!absenceBlocksSlot(absence, slot)) continue;
    const reason = (
      ["VACATION", "SICK", "SCHOOL_BLOCK", "TRAINING"].includes(absence.type)
        ? absence.type
        : "OTHER"
    ) as UnavailabilityReason;
    return { available: false, reason };
  }
  return { available: true };
}

export const UNAVAILABILITY_LABEL: Record<UnavailabilityReason, string> = {
  NOT_EMPLOYED: "nicht im Ausbildungszeitraum",
  NOT_PLANNABLE: "nicht für die Planung vorgesehen",
  SCHOOL: "Berufsschule",
  VACATION: "Urlaub",
  SICK: "krank",
  SCHOOL_BLOCK: "Blockunterricht",
  TRAINING: "Lehrgang/Prüfung",
  OTHER: "abwesend",
  ALREADY_ASSIGNED: "an diesem Tag bereits eingeteilt",
};
