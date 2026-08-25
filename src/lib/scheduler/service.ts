import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  absences,
  apprentices,
  assignments,
  companyClosures,
  coverageSlots,
  deskShifts,
  deskStaff,
  planRuns,
} from "@/db/schema";
import { addDays, type IsoDate } from "@/lib/dates";
import { resolveHolidays } from "@/lib/calendar";
import { getSetting } from "@/lib/settings";
import { describeDays, generatePlan } from "./engine";
import type { SchedulerInput, SchedulerResult, SchedulerSlot } from "./types";

/**
 * Lädt alle Stammdaten, die die Engine für einen Zeitraum benötigt.
 * Für den Lastenausgleich werden zusätzlich die Einsätze der vergangenen
 * Wochen (Fairness-Fenster) mitgeladen.
 */
export async function loadSchedulerInput(
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
  opts: { overwriteExisting?: boolean } = {},
): Promise<SchedulerInput> {
  const [general, planning] = await Promise.all([
    getSetting("general"),
    getSetting("planning"),
  ]);
  const historyStart = addDays(rangeStart, -general.fairnessWindowDays);

  const [
    apprenticeRows,
    slotRows,
    schoolRows,
    absenceRows,
    shiftRows,
    deskAbsenceRows,
    holidayRows,
    closureRows,
    assignmentRows,
  ] = await Promise.all([
    db.query.apprentices.findMany({ orderBy: (a, { asc }) => [asc(a.displayName)] }),
    db.select().from(coverageSlots).orderBy(asc(coverageSlots.sortOrder)),
    db.query.schoolTerms.findMany(),
    // Abwesenheiten der Auszubildenden – sie fallen als Vertretung aus
    db
      .select()
      .from(absences)
      .where(
        and(
          isNotNull(absences.apprenticeId),
          lte(absences.startDate, rangeEnd),
          gte(absences.endDate, historyStart),
        ),
      ),
    db
      .select({
        staffId: deskShifts.staffId,
        staffName: deskStaff.name,
        weekday: deskShifts.weekday,
        validFrom: deskShifts.validFrom,
        validTo: deskShifts.validTo,
        isActive: deskStaff.isActive,
      })
      .from(deskShifts)
      .innerJoin(deskStaff, eq(deskShifts.staffId, deskStaff.id)),
    // Abwesenheiten der Festbesetzung – sie lösen ganztägige Vertretung aus
    db
      .select({
        staffId: absences.deskStaffId,
        startDate: absences.startDate,
        endDate: absences.endDate,
      })
      .from(absences)
      .where(
        and(
          isNotNull(absences.deskStaffId),
          lte(absences.startDate, rangeEnd),
          gte(absences.endDate, rangeStart),
        ),
      ),
    resolveHolidays(historyStart, rangeEnd, general.region),
    db
      .select()
      .from(companyClosures)
      .where(and(lte(companyClosures.startDate, rangeEnd), gte(companyClosures.endDate, rangeStart))),
    db
      .select()
      .from(assignments)
      .where(
        and(
          gte(assignments.date, historyStart),
          lte(assignments.date, rangeEnd),
          eq(assignments.status, "PLANNED"),
        ),
      ),
  ]);

  return {
    rangeStart,
    rangeEnd,
    apprentices: apprenticeRows.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      startDate: a.startDate,
      endDate: a.endDate,
      isPlannable: a.isPlannable,
      loadFactor: Number(a.loadFactor),
      loadOffset: Number(a.loadOffset),
    })),
    slots: slotRows.map(toSchedulerSlot),
    schoolTerms: schoolRows.map((t) => ({
      apprenticeId: t.apprenticeId,
      weekday: t.weekday,
      validFrom: t.validFrom,
      validTo: t.validTo,
      intervalWeeks: t.intervalWeeks,
      anchorWeek: t.anchorWeek,
    })),
    absences: absenceRows.map((a) => ({
      apprenticeId: a.apprenticeId!,
      type: a.type,
      dayPart: a.dayPart,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
    deskShifts: shiftRows
      .filter((s) => s.isActive)
      .map((s) => ({
        staffId: s.staffId,
        staffName: s.staffName,
        weekday: s.weekday,
        validFrom: s.validFrom,
        validTo: s.validTo,
      })),
    deskAbsences: deskAbsenceRows.map((a) => ({
      staffId: a.staffId!,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
    holidays: holidayRows,
    closures: closureRows.map((c) => ({
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      blocksPlanning: c.blocksPlanning,
    })),
    existingAssignments: assignmentRows.map((a) => ({
      id: a.id,
      date: a.date,
      slotId: a.slotId,
      rank: a.rank,
      apprenticeId: a.apprenticeId,
      isLocked: a.isLocked,
      isManual: a.isManual,
    })),
    options: {
      minGapDays: planning.minGapDays,
      maxPerWeek: planning.maxPerWeek,
      backupWeight: planning.backupWeight,
      combineBreaks: planning.combineBreaks,
      combinedBreakLabel: planning.combinedBreakLabel,
      historyStart,
      overwriteExisting: opts.overwriteExisting ?? true,
    },
  };
}

export function toSchedulerSlot(slot: typeof coverageSlots.$inferSelect): SchedulerSlot {
  return {
    id: slot.id,
    key: slot.key,
    label: slot.label,
    kind: slot.kind,
    startTime: slot.startTime,
    endTime: slot.endTime,
    weekdays: slot.weekdays,
    weight: Number(slot.weight),
    backupCount: slot.backupCount,
    isActive: slot.isActive,
    sortOrder: slot.sortOrder,
  };
}

/** Erzeugt einen Planvorschlag, ohne etwas zu speichern. */
export async function previewPlan(
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
  opts: { overwriteExisting?: boolean } = {},
): Promise<SchedulerResult> {
  const input = await loadSchedulerInput(rangeStart, rangeEnd, opts);
  return generatePlan(input);
}

/**
 * Erzeugt den Plan und schreibt ihn in die Datenbank. Gesperrte und manuell
 * gesetzte Einträge bleiben erhalten; alles andere im Zeitraum wird ersetzt.
 */
export async function applyPlan(
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
  userId: string | null,
  opts: { overwriteExisting?: boolean } = {},
): Promise<SchedulerResult & { planRunId: string }> {
  const input = await loadSchedulerInput(rangeStart, rangeEnd, opts);
  const result = generatePlan(input);

  const planRunId = await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(planRuns)
      .values({
        rangeStart,
        rangeEnd,
        createdBy: userId,
        stats: result.stats,
        issues: result.issues,
      })
      .returning({ id: planRuns.id });

    // Nicht gesperrte Einträge im Zeitraum entfernen
    await tx
      .delete(assignments)
      .where(
        and(
          gte(assignments.date, rangeStart),
          lte(assignments.date, rangeEnd),
          eq(assignments.isLocked, false),
        ),
      );

    const fresh = result.assignments.filter((a) => !a.existingId);
    if (fresh.length > 0) {
      await tx.insert(assignments).values(
        fresh.map((a) => ({
          date: a.date,
          slotId: a.slotId,
          rank: a.rank,
          apprenticeId: a.apprenticeId,
          isLocked: false,
          isManual: false,
          planRunId: run.id,
          createdBy: userId,
        })),
      );
    }
    return run.id;
  });

  return { ...result, planRunId };
}

/* -------------------------------------------------------------------------- */
/* Abfragen für die Oberfläche                                                */
/* -------------------------------------------------------------------------- */

export type AssignmentView = {
  id: string;
  date: IsoDate;
  rank: number;
  status: string;
  isLocked: boolean;
  isManual: boolean;
  note: string | null;
  apprenticeId: string;
  apprenticeName: string;
  slotId: string;
  slotKey: string;
  slotLabel: string;
  slotKind: "BREAK" | "FULL_DAY";
  startTime: string;
  endTime: string;
  sortOrder: number;
};

export async function getAssignments(
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
  filter: { apprenticeId?: string } = {},
): Promise<AssignmentView[]> {
  const rows = await db
    .select({
      id: assignments.id,
      date: assignments.date,
      rank: assignments.rank,
      status: assignments.status,
      isLocked: assignments.isLocked,
      isManual: assignments.isManual,
      note: assignments.note,
      apprenticeId: assignments.apprenticeId,
      apprenticeName: apprentices.displayName,
      slotId: coverageSlots.id,
      slotKey: coverageSlots.key,
      slotLabel: coverageSlots.label,
      slotKind: coverageSlots.kind,
      startTime: coverageSlots.startTime,
      endTime: coverageSlots.endTime,
      sortOrder: coverageSlots.sortOrder,
    })
    .from(assignments)
    .innerJoin(apprentices, eq(assignments.apprenticeId, apprentices.id))
    .innerJoin(coverageSlots, eq(assignments.slotId, coverageSlots.id))
    .where(
      and(
        gte(assignments.date, rangeStart),
        lte(assignments.date, rangeEnd),
        filter.apprenticeId ? eq(assignments.apprenticeId, filter.apprenticeId) : undefined,
        eq(assignments.status, "PLANNED"),
      ),
    )
    .orderBy(asc(assignments.date), asc(coverageSlots.sortOrder), asc(assignments.rank));

  return rows as AssignmentView[];
}

/** Lastübersicht je Azubi über einen Zeitraum – Grundlage der Fairness-Anzeige. */
export async function getLoadOverview(rangeStart: IsoDate, rangeEnd: IsoDate) {
  const rows = await db
    .select({
      apprenticeId: apprentices.id,
      apprenticeName: apprentices.displayName,
      isPlannable: apprentices.isPlannable,
      loadFactor: apprentices.loadFactor,
      primaryCount: sql<number>`count(*) filter (where ${assignments.rank} = 1)::int`,
      backupCount: sql<number>`count(*) filter (where ${assignments.rank} > 1)::int`,
      fullDayCount: sql<number>`count(*) filter (where ${assignments.rank} = 1 and ${coverageSlots.kind} = 'FULL_DAY')::int`,
      weighted: sql<string>`coalesce(sum(${coverageSlots.weight}) filter (where ${assignments.rank} = 1), 0)`,
    })
    .from(apprentices)
    .leftJoin(
      assignments,
      and(
        eq(assignments.apprenticeId, apprentices.id),
        gte(assignments.date, rangeStart),
        lte(assignments.date, rangeEnd),
        eq(assignments.status, "PLANNED"),
      ),
    )
    .leftJoin(coverageSlots, eq(assignments.slotId, coverageSlots.id))
    .groupBy(apprentices.id, apprentices.displayName, apprentices.isPlannable, apprentices.loadFactor)
    .orderBy(asc(apprentices.displayName));

  return rows.map((r) => ({
    ...r,
    loadFactor: Number(r.loadFactor),
    weighted: Number(r.weighted),
  }));
}

/** Alle Einsätze eines Azubis ab heute – für "Mein Plan" und den ICS-Feed. */
export async function getUpcomingForApprentice(
  apprenticeId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<AssignmentView[]> {
  return getAssignments(from, to, { apprenticeId });
}

/* -------------------------------------------------------------------------- */
/* Plantafel                                                                  */
/* -------------------------------------------------------------------------- */

export type BoardEntry = {
  rank: number;
  apprenticeId: string;
  apprenticeName: string;
  isLocked: boolean;
  isManual: boolean;
  /** Ein Dienst kann aus mehreren Slots bestehen – hier alle zugehörigen IDs. */
  assignmentIds: string[];
};

export type BoardDuty = {
  key: string;
  label: string;
  kind: "BREAK" | "FULL_DAY";
  slotIds: string[];
  times: { slotId: string; label: string; startTime: string; endTime: string }[];
  backupCount: number;
  entries: BoardEntry[];
  missingRanks: number[];
};

export type BoardDay = {
  date: IsoDate;
  weekday: number;
  isWorkday: boolean;
  skipReason?: string;
  holidayName?: string;
  closureName?: string;
  absentStaff: string[];
  requiresFullDay: boolean;
  duties: BoardDuty[];
};

/**
 * Kombiniert den Tageskontext (Feiertage, Betriebsferien, Ausfall der
 * Festbesetzung) mit den tatsächlich gespeicherten Einteilungen.
 */
export async function getPlanBoard(rangeStart: IsoDate, rangeEnd: IsoDate): Promise<BoardDay[]> {
  const [input, entries] = await Promise.all([
    loadSchedulerInput(rangeStart, rangeEnd),
    getAssignments(rangeStart, rangeEnd),
  ]);
  const contexts = describeDays(input);

  const byDaySlot = new Map<string, AssignmentView[]>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.slotId}`;
    const list = byDaySlot.get(key) ?? [];
    list.push(entry);
    byDaySlot.set(key, list);
  }

  return contexts.map((context) => ({
    date: context.date,
    weekday: context.weekday,
    isWorkday: context.isWorkday,
    skipReason: context.skipReason,
    holidayName: context.holidayName,
    closureName: context.closureName,
    absentStaff: context.absentStaff,
    requiresFullDay: context.requiresFullDay,
    duties: context.duties.map((duty) => {
      /** Alle Einteilungen des Dienstes, nach Rang und Person zusammengefasst. */
      const byRank = new Map<number, BoardEntry>();
      for (const slot of duty.slots) {
        for (const row of byDaySlot.get(`${context.date}|${slot.id}`) ?? []) {
          const existing = byRank.get(row.rank);
          if (existing && existing.apprenticeId === row.apprenticeId) {
            existing.assignmentIds.push(row.id);
            existing.isLocked ||= row.isLocked;
            existing.isManual ||= row.isManual;
            continue;
          }
          if (existing) continue; // widersprüchliche Altdaten: erster Eintrag gewinnt
          byRank.set(row.rank, {
            rank: row.rank,
            apprenticeId: row.apprenticeId,
            apprenticeName: row.apprenticeName,
            isLocked: row.isLocked,
            isManual: row.isManual,
            assignmentIds: [row.id],
          });
        }
      }

      const missingRanks: number[] = [];
      for (let rank = 1; rank <= 1 + duty.backupCount; rank++) {
        if (!byRank.has(rank)) missingRanks.push(rank);
      }

      return {
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
        backupCount: duty.backupCount,
        entries: [...byRank.values()].sort((a, b) => a.rank - b.rank),
        missingRanks,
      };
    }),
  }));
}

/** Liste aller Azubis für Auswahlfelder. */
export async function listApprentices() {
  return db.query.apprentices.findMany({
    orderBy: (a, { asc }) => [asc(a.displayName)],
  });
}
