import type { IsoDate } from "@/lib/dates";
import type { DayPart, SlotKind } from "@/db/schema";

export type SchedulerSlot = {
  id: string;
  key: string;
  label: string;
  kind: SlotKind;
  startTime: string;
  endTime: string;
  weekdays: number[];
  weight: number;
  backupCount: number;
  isActive: boolean;
  sortOrder: number;
};

export type SchedulerApprentice = {
  id: string;
  displayName: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  isPlannable: boolean;
  loadFactor: number;
  loadOffset: number;
};

export type SchedulerSchoolTerm = {
  apprenticeId: string;
  weekday: number;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  intervalWeeks: number;
  anchorWeek: IsoDate | null;
};

export type SchedulerAbsence = {
  apprenticeId: string;
  type: string;
  dayPart: DayPart;
  startDate: IsoDate;
  endDate: IsoDate;
};

export type SchedulerDeskShift = {
  staffId: string;
  staffName: string;
  weekday: number;
  validFrom: IsoDate;
  validTo: IsoDate | null;
};

export type SchedulerDeskAbsence = {
  staffId: string;
  startDate: IsoDate;
  endDate: IsoDate;
};

export type SchedulerHoliday = { date: IsoDate; name: string };

export type SchedulerClosure = {
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  blocksPlanning: boolean;
};

export type ExistingAssignment = {
  id: string;
  date: IsoDate;
  slotId: string;
  rank: number;
  apprenticeId: string;
  isLocked: boolean;
  isManual: boolean;
};

export type SchedulerOptions = {
  /** Mindestabstand in Tagen zwischen zwei Einsätzen als Vertretung (weich). */
  minGapDays: number;
  /** Höchstzahl an Vertretungen pro Person und Woche (weich). */
  maxPerWeek: number;
  /** Gewicht, mit dem eine Ersatz-Nominierung auf das Lastkonto zählt. */
  backupWeight: number;
  /**
   * Alle Pausen eines Tages werden von derselben Person übernommen.
   * Ist die Option aus, wird jede Pause einzeln besetzt.
   */
  combineBreaks: boolean;
  /** Beschriftung der zusammengefassten Tagesvertretung. */
  combinedBreakLabel: string;
  /** Bereits geplante Einsätze vor dem Zeitraum fließen als Historie ein. */
  historyStart?: IsoDate;
  /** Bestehende, nicht gesperrte Einträge überschreiben. */
  overwriteExisting: boolean;
};

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  minGapDays: 1,
  maxPerWeek: 3,
  backupWeight: 0.15,
  combineBreaks: true,
  combinedBreakLabel: "Pausenvertretung",
  overwriteExisting: true,
};

export type SchedulerInput = {
  rangeStart: IsoDate;
  rangeEnd: IsoDate;
  apprentices: SchedulerApprentice[];
  slots: SchedulerSlot[];
  schoolTerms: SchedulerSchoolTerm[];
  absences: SchedulerAbsence[];
  deskShifts: SchedulerDeskShift[];
  deskAbsences: SchedulerDeskAbsence[];
  holidays: SchedulerHoliday[];
  closures: SchedulerClosure[];
  /** Einsätze im Zeitraum + Historie davor. */
  existingAssignments: ExistingAssignment[];
  options?: Partial<SchedulerOptions>;
};

export type UnavailabilityReason =
  | "NOT_EMPLOYED"
  | "NOT_PLANNABLE"
  | "SCHOOL"
  | "VACATION"
  | "SICK"
  | "SCHOOL_BLOCK"
  | "TRAINING"
  | "OTHER"
  | "ALREADY_ASSIGNED";

/**
 * Ein Dienst ist das, was eine Person an einem Tag übernimmt.
 * Im Regelfall sind das alle Pausen des Tages zusammen – dieselbe Person
 * macht Frühstücks- und Mittagspause. Fällt die Festbesetzung aus, ist der
 * Dienst stattdessen die ganztägige Vertretung.
 */
export type Duty = {
  key: string;
  label: string;
  kind: SlotKind;
  slots: SchedulerSlot[];
  /** Wie viele Ersatzleute zusätzlich zur Vertretung geplant werden. */
  backupCount: number;
  /** Gewicht des gesamten Dienstes für den Lastenausgleich. */
  weight: number;
};

export type PlannedAssignment = {
  date: IsoDate;
  slotId: string;
  rank: number;
  apprenticeId: string;
  isLocked: boolean;
  isManual: boolean;
  /** Vorhandener Datensatz, der übernommen wurde. */
  existingId?: string;
};

export type DutyPlan = {
  key: string;
  label: string;
  kind: SlotKind;
  slotIds: string[];
  /** Zeitfenster des Dienstes – bei zusammengefassten Pausen mehrere. */
  times: { slotId: string; label: string; startTime: string; endTime: string }[];
  assigned: {
    rank: number;
    apprenticeId: string;
    isLocked: boolean;
    isManual: boolean;
  }[];
  availableCount: number;
  unfilledRanks: number[];
};

export type DayPlan = {
  date: IsoDate;
  weekday: number;
  isWorkday: boolean;
  skipReason?: string;
  holidayName?: string;
  closureName?: string;
  /** Festbesetzung, die an diesem Tag ausfällt. */
  absentStaff: string[];
  requiresFullDay: boolean;
  duties: DutyPlan[];
};

export type SchedulerResult = {
  assignments: PlannedAssignment[];
  days: DayPlan[];
  /** Lastkonto je Azubi nach dem Lauf. */
  load: Record<string, { primary: number; backup: number; score: number }>;
  issues: string[];
  stats: {
    daysPlanned: number;
    dutiesPlanned: number;
    slotsPlanned: number;
    unfilledRanks: number;
    fullDayCovers: number;
    keptLocked: number;
  };
};
