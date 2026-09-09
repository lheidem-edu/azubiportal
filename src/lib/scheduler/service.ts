import { and, asc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
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
  schoolHolidayApprentices,
  schoolHolidays,
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
    schoolHolidayRows,
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
    // Mit Geltungsbereich: Ein Eintrag ohne zugeordnete Personen gilt für alle.
    db
      .select({
        id: schoolHolidays.id,
        startDate: schoolHolidays.startDate,
        endDate: schoolHolidays.endDate,
        apprenticeId: schoolHolidayApprentices.apprenticeId,
      })
      .from(schoolHolidays)
      .leftJoin(
        schoolHolidayApprentices,
        eq(schoolHolidayApprentices.schoolHolidayId, schoolHolidays.id),
      )
      .where(
        and(
          eq(schoolHolidays.isActive, true),
          lte(schoolHolidays.startDate, rangeEnd),
          gte(schoolHolidays.endDate, historyStart),
        ),
      ),
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
    schoolHolidays: groupSchoolHolidays(schoolHolidayRows),
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
  /** Die Person fällt aus – etwa wegen einer Krankmeldung. */
  droppedOut: boolean;
  /** Diese Person übernimmt den Dienst tatsächlich. */
  isActing: boolean;
  /** Sie ist dabei nachgerückt, war also ursprünglich nur Ersatz. */
  isStandIn: boolean;
  /** Für wen sie einspringt. */
  standsInFor: string | null;
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
        ne(assignments.status, "CANCELLED"),
      ),
    )
    .orderBy(asc(assignments.date), asc(coverageSlots.sortOrder), asc(assignments.rank));

  /**
   * Wer den Dienst tatsächlich übernimmt, hängt von den anderen Einträgen
   * desselben Slots ab: Fällt die Vertretung aus, rückt der niedrigste noch
   * verfügbare Rang nach. Deshalb wird immer der ganze Slot geladen und erst
   * danach auf die gesuchte Person gefiltert.
   */
  const dropouts = await db
    .select({
      date: assignments.date,
      slotId: assignments.slotId,
      rank: assignments.rank,
      name: apprentices.displayName,
    })
    .from(assignments)
    .innerJoin(apprentices, eq(assignments.apprenticeId, apprentices.id))
    .where(
      and(
        gte(assignments.date, rangeStart),
        lte(assignments.date, rangeEnd),
        eq(assignments.status, "CANCELLED"),
      ),
    );

  const droppedBySlot = new Map<string, { rank: number; name: string }[]>();
  for (const entry of dropouts) {
    const key = `${entry.date}|${entry.slotId}`;
    const list = droppedBySlot.get(key) ?? [];
    list.push({ rank: entry.rank, name: entry.name });
    droppedBySlot.set(key, list);
  }

  const actingRank = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.date}|${row.slotId}`;
    const current = actingRank.get(key);
    if (current === undefined || row.rank < current) actingRank.set(key, row.rank);
  }

  const views: AssignmentView[] = rows.map((row) => {
    const key = `${row.date}|${row.slotId}`;
    const isActing = actingRank.get(key) === row.rank;
    const replaced = (droppedBySlot.get(key) ?? [])
      .filter((entry) => entry.rank < row.rank)
      .sort((a, b) => a.rank - b.rank);
    return {
      ...row,
      droppedOut: false,
      isActing,
      isStandIn: isActing && row.rank > 1,
      standsInFor: isActing && replaced.length > 0 ? replaced[0].name : null,
    };
  });

  return filter.apprenticeId
    ? views.filter((view) => view.apprenticeId === filter.apprenticeId)
    : views;
}

/** Ausgefallene Einteilungen eines Zeitraums – für die Anzeige „ist krank". */
export async function getDropouts(
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
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
        eq(assignments.status, "CANCELLED"),
      ),
    )
    .orderBy(asc(assignments.date), asc(coverageSlots.sortOrder), asc(assignments.rank));

  return rows.map((row) => ({
    ...row,
    droppedOut: true,
    isActing: false,
    isStandIn: false,
    standsInFor: null,
  }));
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
  /** Die Person fällt aus und ist nur noch zur Information aufgeführt. */
  droppedOut: boolean;
  /** Diese Person übernimmt den Dienst tatsächlich. */
  isActing: boolean;
  /** Sie ist dabei nachgerückt. */
  isStandIn: boolean;
};

export type BoardDuty = {
  key: string;
  label: string;
  kind: "BREAK" | "FULL_DAY";
  /** Gesetzt, wenn der Dienst von einer Person aus einem anderen übernommen wird. */
  derivedFrom?: { dutyKey: string; rank: number };
  slotIds: string[];
  times: { slotId: string; label: string; startTime: string; endTime: string }[];
  backupCount: number;
  entries: BoardEntry[];
  /** Jemand übernimmt den Dienst tatsächlich. */
  hasActing: boolean;
  /** So viele Ersatzleute fehlen noch. */
  missingBackups: number;
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
  // Ausgefallene Personen bleiben sichtbar – durchgestrichen neben der Person,
  // die für sie einspringt.
  const dropouts = await getDropouts(rangeStart, rangeEnd);
  const contexts = describeDays(input);

  const byDaySlot = new Map<string, AssignmentView[]>();
  for (const entry of [...entries, ...dropouts]) {
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
      const byKey = new Map<string, BoardEntry>();
      for (const slot of duty.slots) {
        for (const row of byDaySlot.get(`${context.date}|${slot.id}`) ?? []) {
          // Ausgefallene und nachgerückte Person teilen sich denselben Rang,
          // deshalb gehört der Status in den Schlüssel.
          const key = `${row.rank}|${row.droppedOut ? "out" : "in"}`;
          const existing = byKey.get(key);
          if (existing && existing.apprenticeId === row.apprenticeId) {
            existing.assignmentIds.push(row.id);
            existing.isLocked ||= row.isLocked;
            existing.isManual ||= row.isManual;
            continue;
          }
          if (existing) continue; // widersprüchliche Altdaten: erster Eintrag gewinnt
          byKey.set(key, {
            rank: row.rank,
            apprenticeId: row.apprenticeId,
            apprenticeName: row.apprenticeName,
            isLocked: row.isLocked,
            isManual: row.isManual,
            assignmentIds: [row.id],
            droppedOut: row.droppedOut,
            isActing: row.isActing,
            isStandIn: row.isStandIn,
          });
        }
      }

      /**
       * Was fehlt, misst sich an den Personen, die noch da sind – nicht an den
       * Rangnummern. Fällt die Vertretung aus und jemand rückt nach, ist der
       * Dienst besetzt, auch wenn Rang 1 leer steht.
       */
      const available = [...byKey.values()].filter((entry) => !entry.droppedOut);
      const hasActing = available.some((entry) => entry.isActing);
      const standby = available.filter((entry) => !entry.isActing).length;
      const missingBackups = Math.max(0, duty.backupCount - standby);

      return {
        key: duty.key,
        label: duty.label,
        kind: duty.kind,
        derivedFrom: duty.derivedFrom,
        slotIds: duty.slots.map((s) => s.id),
        times: duty.slots.map((s) => ({
          slotId: s.id,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        backupCount: duty.backupCount,
        entries: [...byKey.values()].sort(
          (a, b) => a.rank - b.rank || Number(b.droppedOut) - Number(a.droppedOut),
        ),
        hasActing,
        missingBackups,
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

/**
 * Fasst die Zeilen des Verbunds zu je einem Zeitraum zusammen. Ein Eintrag
 * ohne zugeordnete Person gilt für alle und behält eine leere Liste.
 */
function groupSchoolHolidays(
  rows: { id: string; startDate: string; endDate: string; apprenticeId: string | null }[],
) {
  const byId = new Map<string, { startDate: string; endDate: string; apprenticeIds: string[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? {
      startDate: row.startDate,
      endDate: row.endDate,
      apprenticeIds: [],
    };
    if (row.apprenticeId) entry.apprenticeIds.push(row.apprenticeId);
    byId.set(row.id, entry);
  }
  return [...byId.values()];
}
