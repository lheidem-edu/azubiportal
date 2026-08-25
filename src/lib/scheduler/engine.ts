import { eachDay, formatDateDe, isoWeekday, startOfIsoWeek, type IsoDate } from "@/lib/dates";
import { buildAvailabilityLookup, checkAvailability, type AvailabilityLookup } from "./availability";
import {
  DEFAULT_SCHEDULER_OPTIONS,
  type DayPlan,
  type Duty,
  type DutyPlan,
  type ExistingAssignment,
  type PlannedAssignment,
  type SchedulerApprentice,
  type SchedulerInput,
  type SchedulerOptions,
  type SchedulerResult,
} from "./types";

type LoadState = {
  primary: number;
  backup: number;
  lastPrimary?: IsoDate;
  lastAny?: IsoDate;
  weekPrimary: Map<IsoDate, number>;
};

/** Weiche Nebenbedingungen: Verstöße kosten Punkte, verhindern aber nichts. */
const PENALTY_MIN_GAP = 0.8;
const PENALTY_MAX_PER_WEEK = 1.6;
const PENALTY_SAME_DAY = 0.6;

/* -------------------------------------------------------------------------- */
/* Tageskontext                                                               */
/* -------------------------------------------------------------------------- */

export type DayContext = {
  date: IsoDate;
  weekday: number;
  isWorkday: boolean;
  skipReason?: string;
  holidayName?: string;
  closureName?: string;
  /** Namen der Festbesetzung, die an diesem Tag ausfällt. */
  absentStaff: string[];
  requiresFullDay: boolean;
  /** Dienste, die an diesem Tag zu besetzen sind. */
  duties: Duty[];
  /** Hinweise, die beim Ermitteln des Tages aufgefallen sind. */
  notes: string[];
};

/**
 * Bestimmt für jeden Tag im Zeitraum, ob und wie vertreten werden muss:
 * Wochenende, Feiertag und Betriebsferien fallen heraus, bei Ausfall der
 * Festbesetzung wird aus der Pausenvertretung eine ganztägige Vertretung.
 *
 * Planung und Anzeige benutzen dieselbe Funktion – dadurch zeigt die
 * Oberfläche exakt das, wonach auch geplant wurde.
 */
export function describeDays(input: SchedulerInput): DayContext[] {
  const options: SchedulerOptions = { ...DEFAULT_SCHEDULER_OPTIONS, ...input.options };
  const activeSlots = input.slots
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime));
  const breakSlots = activeSlots.filter((s) => s.kind === "BREAK");
  const fullDaySlots = activeSlots.filter((s) => s.kind === "FULL_DAY");
  const holidayByDate = new Map(input.holidays.map((h) => [h.date, h.name]));

  return eachDay(input.rangeStart, input.rangeEnd).map((date) => {
    const weekday = isoWeekday(date);
    const day: DayContext = {
      date,
      weekday,
      isWorkday: true,
      absentStaff: [],
      requiresFullDay: false,
      duties: [],
      notes: [],
    };

    if (weekday >= 6) {
      return { ...day, isWorkday: false, skipReason: "Wochenende" };
    }
    const holiday = holidayByDate.get(date);
    if (holiday) {
      return { ...day, isWorkday: false, skipReason: "Feiertag", holidayName: holiday };
    }
    const closure = input.closures.find(
      (c) => c.blocksPlanning && date >= c.startDate && date <= c.endDate,
    );
    if (closure) {
      return { ...day, isWorkday: false, skipReason: "Betriebsferien", closureName: closure.name };
    }

    const scheduledStaff = input.deskShifts.filter(
      (s) => s.weekday === weekday && date >= s.validFrom && (!s.validTo || date <= s.validTo),
    );
    const absentStaff = scheduledStaff.filter((s) =>
      input.deskAbsences.some(
        (a) => a.staffId === s.staffId && date >= a.startDate && date <= a.endDate,
      ),
    );
    day.absentStaff = absentStaff.map((s) => s.staffName);

    if (scheduledStaff.length === 0) {
      day.requiresFullDay = true;
      day.notes.push(
        `${formatDateDe(date)}: Für diesen Wochentag ist niemand fest in der Zentrale eingeteilt – es wird ganztägige Vertretung geplant.`,
      );
    } else if (absentStaff.length > 0 && absentStaff.length === scheduledStaff.length) {
      day.requiresFullDay = true;
    }

    /**
     * Fällt die Festbesetzung aus, wird die Zentrale ganztägig vertreten –
     * und diese Person braucht selbst Pausen. Deshalb werden an solchen Tagen
     * beide Dienste besetzt: die ganztägige Vertretung zuerst, danach die
     * Pausenvertretung für sie.
     */
    const forWeekday = (slots: SchedulerSlot[]) =>
      slots.filter((slot) => slot.weekdays.includes(weekday));

    day.duties = [
      ...(day.requiresFullDay ? buildDuties(forWeekday(fullDaySlots), true, options) : []),
      ...buildDuties(forWeekday(breakSlots), false, options),
    ];

    if (day.duties.length === 0) {
      day.isWorkday = false;
      day.skipReason = day.requiresFullDay
        ? "Kein Slot für diesen Wochentag konfiguriert"
        : "Keine Vertretung an diesem Wochentag vorgesehen";
    }
    return day;
  });
}

/**
 * Fasst die Pausen eines Tages zu einem Dienst zusammen, damit dieselbe Person
 * Frühstücks- und Mittagspause übernimmt. Ist `combineBreaks` deaktiviert,
 * wird jede Pause weiterhin einzeln besetzt.
 */
function buildDuties(
  slots: SchedulerSlot[],
  isFullDay: boolean,
  options: SchedulerOptions,
): Duty[] {
  if (slots.length === 0) return [];

  if (!isFullDay && options.combineBreaks && slots.length > 1) {
    return [
      {
        key: "BREAKS",
        label: options.combinedBreakLabel,
        kind: "BREAK",
        slots,
        backupCount: Math.max(...slots.map((s) => s.backupCount)),
        weight: slots.reduce((sum, s) => sum + s.weight, 0),
      },
    ];
  }

  return slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    kind: slot.kind,
    slots: [slot],
    backupCount: slot.backupCount,
    weight: slot.weight,
  }));
}

type SchedulerSlot = Duty["slots"][number];

/* -------------------------------------------------------------------------- */
/* Planung                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Erzeugt den Vertretungsplan für einen Zeitraum.
 *
 * Die Funktion ist bewusst frei von Datenbank- und Framework-Abhängigkeiten:
 * Sie bekommt alle Stammdaten hineingereicht und liefert einen vollständigen
 * Vorschlag zurück. Dadurch ist sie deterministisch, testbar und kann sowohl
 * für die Vorschau als auch für das tatsächliche Speichern verwendet werden.
 */
export function generatePlan(input: SchedulerInput): SchedulerResult {
  const options: SchedulerOptions = { ...DEFAULT_SCHEDULER_OPTIONS, ...input.options };
  const issues: string[] = [];

  const apprentices = [...input.apprentices].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "de"),
  );
  const apprenticeById = new Map(apprentices.map((a) => [a.id, a]));
  const lookup = buildAvailabilityLookup(input.schoolTerms, input.absences);
  const slotsById = new Map(input.slots.map((s) => [s.id, s]));

  /* ---- Lastkonto initialisieren --------------------------------------- */

  const load = new Map<string, LoadState>();
  for (const a of apprentices) {
    load.set(a.id, { primary: a.loadOffset, backup: 0, weekPrimary: new Map() });
  }

  // Historie: pro Tag und Person zählt der Dienst einmal, auch wenn er aus
  // mehreren Slots besteht.
  const history = input.existingAssignments.filter((a) => a.date < input.rangeStart);
  for (const entry of groupHistory(history, slotsById)) {
    const state = load.get(entry.apprenticeId);
    if (!state) continue;
    applyLoad(state, entry.date, entry.weight, entry.rank, options);
  }

  /* ---- Bestehende Einträge im Zeitraum -------------------------------- */

  const inRange = input.existingAssignments.filter(
    (a) => a.date >= input.rangeStart && a.date <= input.rangeEnd,
  );
  const keepByDate = new Map<IsoDate, ExistingAssignment[]>();
  let keptLocked = 0;
  for (const entry of inRange) {
    if (!(entry.isLocked || !options.overwriteExisting)) continue;
    keptLocked += 1;
    const list = keepByDate.get(entry.date) ?? [];
    list.push(entry);
    keepByDate.set(entry.date, list);
  }

  /* ---- Tag für Tag planen --------------------------------------------- */

  const result: PlannedAssignment[] = [];
  const days: DayPlan[] = [];
  let daysPlanned = 0;
  let dutiesPlanned = 0;
  let unfilledRanks = 0;
  let fullDayCovers = 0;

  for (const context of describeDays({ ...input, options })) {
    issues.push(...context.notes);

    const day: DayPlan = {
      date: context.date,
      weekday: context.weekday,
      isWorkday: context.isWorkday,
      skipReason: context.skipReason,
      holidayName: context.holidayName,
      closureName: context.closureName,
      absentStaff: context.absentStaff,
      requiresFullDay: context.requiresFullDay,
      duties: [],
    };

    if (!context.isWorkday) {
      days.push(day);
      continue;
    }

    daysPlanned += 1;
    if (day.requiresFullDay) fullDayCovers += 1;

    /** Wer ist an diesem Tag schon eingeteilt? */
    const primaryToday = new Set<string>();
    const anyToday = new Set<string>();
    const kept = keepByDate.get(context.date) ?? [];

    for (const duty of context.duties) {
      dutiesPlanned += 1;
      const dutySlotIds = new Set(duty.slots.map((s) => s.id));
      const keptForDuty = kept.filter(
        (entry) => dutySlotIds.has(entry.slotId) && apprenticeById.has(entry.apprenticeId),
      );

      /** Rang -> Person, aus gesperrten Einträgen übernommen. */
      const fixedByRank = new Map<number, string>();
      for (const entry of keptForDuty) {
        if (!fixedByRank.has(entry.rank)) fixedByRank.set(entry.rank, entry.apprenticeId);
      }

      const candidates = apprentices.filter((a) => isAvailableForDuty(a, context.date, duty, lookup));
      const totalRanks = 1 + duty.backupCount;
      const chosen = new Map<number, { apprenticeId: string; isLocked: boolean; isManual: boolean }>();
      const taken = new Set<string>();
      const missing: number[] = [];

      for (const [rank, apprenticeId] of fixedByRank) {
        if (rank > totalRanks) continue;
        chosen.set(rank, { apprenticeId, isLocked: true, isManual: true });
        taken.add(apprenticeId);
      }

      for (let rank = 1; rank <= totalRanks; rank++) {
        if (chosen.has(rank)) continue;
        /**
         * Niemand kann an einem Tag zwei Dienste gleichzeitig übernehmen: Wer
         * ganztags vertritt, kann nicht zusätzlich die eigene Pause abdecken.
         * Für Ersatzleute gilt das nicht – sie springen nur im Notfall ein.
         */
        const pool = candidates.filter(
          (c) => !taken.has(c.id) && !(rank === 1 && primaryToday.has(c.id)),
        );
        if (pool.length === 0) {
          missing.push(rank);
          continue;
        }
        const picked = pickBest(pool, {
          date: context.date,
          rank,
          load,
          options,
          primaryToday,
          anyToday,
        });
        chosen.set(rank, { apprenticeId: picked.id, isLocked: false, isManual: false });
        taken.add(picked.id);
      }

      const assigned: DutyPlan["assigned"] = [];
      for (const rank of [...chosen.keys()].sort((a, b) => a - b)) {
        const entry = chosen.get(rank)!;
        assigned.push({ rank, ...entry });

        const state = load.get(entry.apprenticeId);
        if (state) applyLoad(state, context.date, duty.weight, rank, options);
        if (rank === 1) primaryToday.add(entry.apprenticeId);
        anyToday.add(entry.apprenticeId);

        // Ein Dienst erzeugt je Slot einen Datensatz – dadurch bleiben
        // Kalendereinträge und Erinnerungen pro Pause erhalten.
        for (const slot of duty.slots) {
          const existing = keptForDuty.find(
            (k) => k.slotId === slot.id && k.rank === rank && k.apprenticeId === entry.apprenticeId,
          );
          result.push({
            date: context.date,
            slotId: slot.id,
            rank,
            apprenticeId: entry.apprenticeId,
            isLocked: existing?.isLocked ?? entry.isLocked,
            isManual: existing?.isManual ?? entry.isManual,
            existingId: existing?.id,
          });
        }
      }

      if (missing.includes(1)) {
        issues.push(
          `${formatDateDe(context.date)} · ${duty.label}: Keine Vertretung verfügbar (niemand einsatzbereit).`,
        );
      } else if (missing.length > 0) {
        issues.push(
          `${formatDateDe(context.date)} · ${duty.label}: Nur ${
            duty.backupCount - missing.length
          } von ${duty.backupCount} Ersatzleuten verfügbar.`,
        );
      }
      unfilledRanks += missing.length;

      day.duties.push({
        key: duty.key,
        label: duty.label,
        kind: duty.kind,
        slotIds: duty.slots.map((s) => s.id),
        times: duty.slots.map((s) => ({
          slotId: s.id,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        assigned,
        availableCount: candidates.length,
        unfilledRanks: missing,
      });
    }

    days.push(day);
  }

  const loadOut: SchedulerResult["load"] = {};
  for (const [id, state] of load) {
    const apprentice = apprenticeById.get(id);
    loadOut[id] = {
      primary: round2(state.primary),
      backup: round2(state.backup),
      score: round2(scoreOf(state, apprentice?.loadFactor || 1, options)),
    };
  }

  return {
    assignments: result,
    days,
    load: loadOut,
    issues,
    stats: {
      daysPlanned,
      dutiesPlanned,
      slotsPlanned: result.length,
      unfilledRanks,
      fullDayCovers,
      keptLocked,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Verfügbarkeit & Auswahl                                                    */
/* -------------------------------------------------------------------------- */

/** Für einen Dienst zählt nur, wer für alle enthaltenen Zeitfenster frei ist. */
function isAvailableForDuty(
  apprentice: SchedulerApprentice,
  date: IsoDate,
  duty: Duty,
  lookup: AvailabilityLookup,
): boolean {
  return duty.slots.every((slot) => checkAvailability(apprentice, date, slot, lookup).available);
}

type PickContext = {
  date: IsoDate;
  rank: number;
  load: Map<string, LoadState>;
  options: SchedulerOptions;
  primaryToday: Set<string>;
  anyToday: Set<string>;
};

/**
 * Wählt die Person mit der geringsten gewichteten Belastung. Bei Gleichstand
 * entscheidet der längere Abstand zum letzten Einsatz, danach der Name –
 * so ist das Ergebnis reproduzierbar.
 */
function pickBest(pool: SchedulerApprentice[], ctx: PickContext): SchedulerApprentice {
  let best: SchedulerApprentice | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestTiebreak = "";

  for (const candidate of pool) {
    const state = ctx.load.get(candidate.id);
    if (!state) continue;
    const score = effectiveScore(candidate, state, ctx);
    const tiebreak = `${state.lastPrimary ?? "0000-00-00"}|${candidate.displayName}`;
    if (
      score < bestScore - 1e-9 ||
      (Math.abs(score - bestScore) < 1e-9 && tiebreak < bestTiebreak)
    ) {
      best = candidate;
      bestScore = score;
      bestTiebreak = tiebreak;
    }
  }
  return best ?? pool[0];
}

function scoreOf(state: LoadState, factor: number, options: SchedulerOptions): number {
  return (state.primary + options.backupWeight * state.backup) / (factor || 1);
}

function effectiveScore(
  apprentice: SchedulerApprentice,
  state: LoadState,
  ctx: PickContext,
): number {
  let score = scoreOf(state, apprentice.loadFactor, ctx.options);

  if (ctx.rank === 1) {
    if (state.lastPrimary) {
      const gap = daysBetween(state.lastPrimary, ctx.date);
      if (gap <= ctx.options.minGapDays) score += PENALTY_MIN_GAP;
    }
    const inWeek = state.weekPrimary.get(startOfIsoWeek(ctx.date)) ?? 0;
    if (inWeek >= ctx.options.maxPerWeek) score += PENALTY_MAX_PER_WEEK;
    if (ctx.primaryToday.has(apprentice.id)) score += PENALTY_SAME_DAY;
  }
  if (ctx.anyToday.has(apprentice.id)) score += PENALTY_SAME_DAY / 2;

  return score;
}

function applyLoad(
  state: LoadState,
  date: IsoDate,
  weight: number,
  rank: number,
  options: SchedulerOptions,
) {
  if (rank === 1) {
    state.primary += weight;
    state.lastPrimary = maxDate(state.lastPrimary, date);
    const week = startOfIsoWeek(date);
    state.weekPrimary.set(week, (state.weekPrimary.get(week) ?? 0) + 1);
  } else {
    state.backup += weight * options.backupWeight;
  }
  state.lastAny = maxDate(state.lastAny, date);
}

/**
 * Fasst vergangene Einsätze zu Diensten zusammen: Wer an einem Tag beide
 * Pausen übernommen hat, hat einen Dienst geleistet – nicht zwei.
 */
function groupHistory(
  history: ExistingAssignment[],
  slotsById: Map<string, SchedulerSlot>,
): { date: IsoDate; apprenticeId: string; rank: number; weight: number }[] {
  const grouped = new Map<string, { date: IsoDate; apprenticeId: string; rank: number; weight: number }>();
  for (const entry of history) {
    const slot = slotsById.get(entry.slotId);
    if (!slot) continue;
    const key = `${entry.date}|${entry.apprenticeId}|${entry.rank}|${slot.kind}`;
    const current = grouped.get(key);
    if (current) current.weight += slot.weight;
    else
      grouped.set(key, {
        date: entry.date,
        apprenticeId: entry.apprenticeId,
        rank: entry.rank,
        weight: slot.weight,
      });
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function maxDate(a: IsoDate | undefined, b: IsoDate): IsoDate {
  return !a || b > a ? b : a;
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
