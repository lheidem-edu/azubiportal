import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { absences, apprentices, assignments, coverageSlots } from "@/db/schema";
import type { DayPart } from "@/db/schema";
import { today, type IsoDate } from "@/lib/dates";

/**
 * Was passiert, wenn jemand ausfällt.
 *
 * Eine Krankmeldung ändert den Plan nicht neu, sondern nimmt die betroffene
 * Person aus ihren Einteilungen (Status `CANCELLED`). Wer dadurch nachrückt,
 * ergibt sich aus dem nächstniedrigeren Rang – das rechnet die Anzeige
 * jeweils selbst aus, damit sich der Ausfall zurücknehmen lässt, ohne dass
 * Ränge durcheinandergeraten.
 */

/**
 * Wer den Dienst übernimmt: der niedrigste Rang, der noch verfügbar ist.
 * Ausgefallene Personen zählen nicht mit.
 */
export function actingRankOf(availableRanks: number[]): number | null {
  if (availableRanks.length === 0) return null;
  return Math.min(...availableRanks);
}

export type StandInInfo = {
  apprenticeId: string;
  name: string;
  email: string;
  notifyEmail: boolean;
  entries: {
    date: IsoDate;
    slotLabel: string;
    startTime: string;
    endTime: string;
    forName: string;
  }[];
};

/** Blockiert die Abwesenheit den Slot? Halbe Tage nur die eigene Tageshälfte. */
export function blocksSlot(dayPart: DayPart, startTime: string): boolean {
  if (dayPart === "FULL") return true;
  const beforeNoon = startTime < "12:00";
  return dayPart === "MORNING" ? beforeNoon : !beforeNoon;
}

/**
 * Nimmt die Person aus allen betroffenen Einteilungen und meldet zurück, wer
 * dadurch einspringen muss. Vergangene Tage bleiben unberührt.
 */
export async function dropOutOfAssignments(input: {
  apprenticeId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  dayPart: DayPart;
}): Promise<StandInInfo[]> {
  const from = input.startDate < today() ? today() : input.startDate;
  if (from > input.endDate) return [];

  const affected = await db
    .select({
      id: assignments.id,
      date: assignments.date,
      slotId: assignments.slotId,
      rank: assignments.rank,
      slotLabel: coverageSlots.label,
      startTime: coverageSlots.startTime,
      endTime: coverageSlots.endTime,
    })
    .from(assignments)
    .innerJoin(coverageSlots, eq(assignments.slotId, coverageSlots.id))
    .where(
      and(
        eq(assignments.apprenticeId, input.apprenticeId),
        gte(assignments.date, from),
        lte(assignments.date, input.endDate),
        ne(assignments.status, "CANCELLED"),
      ),
    );

  const relevant = affected.filter((row) => blocksSlot(input.dayPart, row.startTime));
  if (relevant.length === 0) return [];

  const [person] = await db
    .select({ name: apprentices.displayName })
    .from(apprentices)
    .where(eq(apprentices.id, input.apprenticeId));

  await db
    .update(assignments)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      inArray(
        assignments.id,
        relevant.map((row) => row.id),
      ),
    );

  /* Wer rückt nach? Der niedrigste verbliebene Rang je Slot. */
  const byPerson = new Map<string, StandInInfo>();

  for (const row of relevant) {
    const remaining = await db
      .select({
        apprenticeId: assignments.apprenticeId,
        rank: assignments.rank,
        name: apprentices.displayName,
        email: apprentices.email,
        notifyEmail: apprentices.notifyEmail,
      })
      .from(assignments)
      .innerJoin(apprentices, eq(assignments.apprenticeId, apprentices.id))
      .where(
        and(
          eq(assignments.date, row.date),
          eq(assignments.slotId, row.slotId),
          ne(assignments.status, "CANCELLED"),
        ),
      )
      .orderBy(assignments.rank);

    const next = remaining[0];
    // Nur wer dadurch zur Vertretung wird, muss Bescheid wissen.
    if (!next || next.rank < row.rank) continue;

    const info = byPerson.get(next.apprenticeId) ?? {
      apprenticeId: next.apprenticeId,
      name: next.name,
      email: next.email,
      notifyEmail: next.notifyEmail,
      entries: [],
    };
    info.entries.push({
      date: row.date,
      slotLabel: row.slotLabel,
      startTime: row.startTime,
      endTime: row.endTime,
      forName: person?.name ?? "die eingeteilte Person",
    });
    byPerson.set(next.apprenticeId, info);
  }

  for (const info of byPerson.values()) {
    info.entries.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }
  return [...byPerson.values()];
}

/** Nimmt den Ausfall zurück – die Einteilungen gelten wieder. */
export async function restoreAssignments(input: {
  apprenticeId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}) {
  await db
    .update(assignments)
    .set({ status: "PLANNED", updatedAt: new Date() })
    .where(
      and(
        eq(assignments.apprenticeId, input.apprenticeId),
        gte(assignments.date, input.startDate),
        lte(assignments.date, input.endDate),
        eq(assignments.status, "CANCELLED"),
      ),
    );
}

/** Alle noch offenen Ausfälle einer Person – beim Löschen der Abwesenheit. */
export async function absenceRangeFor(absenceId: string) {
  const [row] = await db
    .select({
      apprenticeId: absences.apprenticeId,
      startDate: absences.startDate,
      endDate: absences.endDate,
      dayPart: absences.dayPart,
    })
    .from(absences)
    .where(eq(absences.id, absenceId));
  return row;
}
