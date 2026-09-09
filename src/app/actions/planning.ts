"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import {
  fail,
  isoDateSchema,
  ok,
  requirePlannerAction,
  run,
  writeAudit,
} from "@/lib/action-utils";
import {
  addDays,
  formatRangeDe,
  nextWorkWeeks,
  type IsoDate,
} from "@/lib/dates";
import {
  applyPlan,
  listApprentices,
  loadSchedulerInput,
  previewPlan,
} from "@/lib/scheduler/service";
import type { SchedulerResult } from "@/lib/scheduler/types";
import {
  buildAvailabilityLookup,
  checkAvailability,
} from "@/lib/scheduler/availability";
import { getSetting } from "@/lib/settings";

function paths() {
  revalidatePath("/planning");
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
  revalidatePath("/");
}

/**
 * Wie mit bereits vergebenen Einteilungen umgegangen wird.
 *
 * `fill` ergänzt nur, was noch offen ist – wer seinen Termin schon kennt,
 * behält ihn. Das ist der Normalfall, auch für den nächtlichen Lauf.
 * `redistribute` wirft alles Ungesperrte weg und verteilt neu; das ändert
 * Termine, die vielleicht schon jemand im Kalender stehen hat, und ist
 * deshalb eine bewusste Handlung.
 */
export type PlanMode = "fill" | "redistribute";

const modeSchema = z.enum(["fill", "redistribute"]).default("fill");

const rangeSchema = z
  .object({
    rangeStart: isoDateSchema,
    rangeEnd: isoDateSchema,
    mode: modeSchema,
  })
  .refine((v) => v.rangeStart <= v.rangeEnd, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["rangeEnd"],
  })
  .refine((v) => addDays(v.rangeStart, 400) >= v.rangeEnd, {
    message: "Bitte höchstens ein Jahr auf einmal planen.",
    path: ["rangeEnd"],
  });

/** Fasst zusammen, was ein Lauf bewirkt hat – oder bewirken würde. */
function summarize(stats: SchedulerResult["stats"], mode: PlanMode): string {
  const kept =
    stats.keptLocked > 0
      ? ` ${stats.keptLocked} bestehende Einteilung${stats.keptLocked === 1 ? "" : "en"} unverändert.`
      : "";
  return mode === "redistribute"
    ? `${stats.daysPlanned} Tage neu verteilt, ${stats.slotsPlanned} Einteilungen.${kept}`
    : `${stats.daysPlanned} Tage geplant, ${stats.slotsPlanned} Einteilungen.${kept}`;
}

/** Eine Zeile der Vorschau: ein Dienst an einem Tag mit den vorgesehenen Namen. */
export type PreviewEntry = {
  rank: number;
  name: string;
  /** Stand schon so im Plan – wird von diesem Lauf nicht angefasst. */
  kept: boolean;
};

export type PreviewDay = {
  date: IsoDate;
  isWorkday: boolean;
  skipReason?: string;
  duties: { key: string; label: string; entries: PreviewEntry[] }[];
};

/**
 * Rechnet einen Lauf durch, ohne etwas zu speichern. Zeigt neben den Namen
 * auch, was unverändert bliebe – erst dadurch ist zu erkennen, was der Lauf
 * tatsächlich anrichtet.
 */
export async function previewPlanAction(input: unknown) {
  return run(async () => {
    const { rangeStart, rangeEnd, mode } = rangeSchema.parse(input);
    await requirePlannerAction();
    const result = await previewPlan(rangeStart, rangeEnd, {
      overwriteExisting: mode === "redistribute",
    });

    const names = new Map(
      (await listApprentices()).map((person) => [
        person.id,
        person.displayName,
      ]),
    );
    const days: PreviewDay[] = result.days.map((day) => ({
      date: day.date,
      isWorkday: day.isWorkday,
      skipReason: day.skipReason,
      duties: day.duties.map((duty) => ({
        key: duty.key,
        label: duty.label,
        entries: duty.assigned.map((entry) => ({
          rank: entry.rank,
          name: names.get(entry.apprenticeId) ?? "Unbekannt",
          // Übernommene Einträge kommen als gesperrt/manuell aus der Engine.
          kept: entry.isManual,
        })),
      })),
    }));

    const fresh = days.reduce(
      (sum, day) =>
        sum +
        day.duties.reduce(
          (n, duty) => n + duty.entries.filter((e) => !e.kept).length,
          0,
        ),
      0,
    );

    return ok(
      fresh === 0
        ? "Es gibt nichts zu ergänzen – der Zeitraum ist vollständig geplant."
        : `Vorschau für ${formatRangeDe(rangeStart, rangeEnd)}: ${fresh} neue Einteilung${fresh === 1 ? "" : "en"}.`,
      { days, issues: result.issues, stats: result.stats, mode, fresh },
    );
  });
}

/**
 * Erzeugt den Plan und speichert ihn. Gesperrte Einträge bleiben immer
 * erhalten; im Modus `fill` zusätzlich alle übrigen bereits vergebenen.
 */
export async function generatePlanAction(input: unknown) {
  return run(async () => {
    const { rangeStart, rangeEnd, mode } = rangeSchema.parse(input);
    const user = await requirePlannerAction();
    const result = await applyPlan(rangeStart, rangeEnd, user.id, {
      overwriteExisting: mode === "redistribute",
    });
    await writeAudit(user, "plan.apply", "plan_run", result.planRunId, {
      rangeStart,
      rangeEnd,
      mode,
      stats: result.stats,
    });
    paths();

    const summary = summarize(result.stats, mode);
    return ok(
      result.issues.length > 0
        ? `${summary} ${result.issues.length} Hinweis(e) – bitte prüfen.`
        : summary,
      { issues: result.issues, stats: result.stats },
    );
  });
}

/**
 * Plant die eingestellte Zahl an Arbeitswochen ab der kommenden Woche.
 * Ergänzt nur Offenes – dieselbe Spanne wird Woche für Woche erneut
 * angefasst, und dabei darf sich Vergebenes nicht verschieben.
 */
export async function generateHorizonAction(input?: unknown) {
  return run(async () => {
    const mode = modeSchema.parse(
      typeof input === "object" && input !== null && "mode" in input
        ? (input as { mode?: unknown }).mode
        : undefined,
    );
    const user = await requirePlannerAction();
    const general = await getSetting("general");
    const { start, end } = nextWorkWeeks(general.planningWeeks);
    const result = await applyPlan(start, end, user.id, {
      overwriteExisting: mode === "redistribute",
    });
    await writeAudit(user, "plan.apply_horizon", "plan_run", result.planRunId, {
      mode,
      ...result.stats,
    });
    paths();
    return ok(
      `${formatRangeDe(start, end)}: ${summarize(result.stats, mode)}`,
      {
        issues: result.issues,
        stats: result.stats,
      },
    );
  });
}

const swapSchema = z.object({
  /** Alle Einteilungen des Dienstes – bei zusammengefassten Pausen mehrere. */
  assignmentIds: z.array(z.string().uuid()).min(1),
  apprenticeId: z.string().uuid(),
  lock: z.boolean().default(true),
});

/**
 * Tauscht eine Einteilung manuell aus. Weil ein Dienst mehrere Pausen umfassen
 * kann, werden immer alle zugehörigen Einträge gemeinsam geändert – dieselbe
 * Person übernimmt damit weiterhin den kompletten Tag.
 */
export async function reassignAction(input: unknown) {
  return run(async () => {
    const data = swapSchema.parse(input);
    const user = await requirePlannerAction();

    const entries = await db
      .select()
      .from(assignments)
      .where(inArray(assignments.id, data.assignmentIds));
    if (entries.length === 0) return fail("Einteilung nicht gefunden.");

    for (const entry of entries) {
      const duplicate = await db.query.assignments.findFirst({
        where: and(
          eq(assignments.date, entry.date),
          eq(assignments.slotId, entry.slotId),
          eq(assignments.apprenticeId, data.apprenticeId),
        ),
      });
      if (duplicate && duplicate.id !== entry.id) {
        return fail("Diese Person ist an dem Tag bereits für diese Vertretung eingeteilt.");
      }
    }

    await db
      .update(assignments)
      .set({
        apprenticeId: data.apprenticeId,
        isManual: true,
        isLocked: data.lock,
        updatedAt: new Date(),
      })
      .where(inArray(assignments.id, data.assignmentIds));

    await writeAudit(user, "assignment.reassign", "assignment", entries[0].id, {
      date: entries[0].date,
      from: entries[0].apprenticeId,
      to: data.apprenticeId,
      count: entries.length,
    });
    paths();
    return ok("Einteilung geändert.");
  });
}

export async function setAssignmentLock(assignmentIds: string[], isLocked: boolean) {
  return run(async () => {
    const user = await requirePlannerAction();
    if (assignmentIds.length === 0) return fail("Keine Einteilung ausgewählt.");
    await db
      .update(assignments)
      .set({ isLocked, updatedAt: new Date() })
      .where(inArray(assignments.id, assignmentIds));
    await writeAudit(user, "assignment.lock", "assignment", assignmentIds[0], {
      isLocked,
      count: assignmentIds.length,
    });
    paths();
    return ok(
      isLocked
        ? "Einteilung gesperrt – der nächste Planlauf lässt sie unverändert."
        : "Sperre aufgehoben.",
    );
  });
}

export async function deleteAssignment(assignmentIds: string[]) {
  return run(async () => {
    const user = await requirePlannerAction();
    if (assignmentIds.length === 0) return fail("Keine Einteilung ausgewählt.");
    await db.delete(assignments).where(inArray(assignments.id, assignmentIds));
    await writeAudit(user, "assignment.delete", "assignment", assignmentIds[0], {
      count: assignmentIds.length,
    });
    paths();
    return ok("Einteilung entfernt.");
  });
}

export async function clearRange(input: unknown) {
  return run(async () => {
    const { rangeStart, rangeEnd } = rangeSchema.parse(input);
    const user = await requirePlannerAction();
    const removed = await db
      .delete(assignments)
      .where(
        and(
          gte(assignments.date, rangeStart),
          lte(assignments.date, rangeEnd),
          eq(assignments.isLocked, false),
        ),
      )
      .returning({ id: assignments.id });
    await writeAudit(user, "plan.clear", "assignment", undefined, { rangeStart, rangeEnd });
    paths();
    return ok(`${removed.length} Einteilungen entfernt (gesperrte blieben erhalten).`);
  });
}

/**
 * Liefert für einen Dienst alle einsatzbereiten Azubis – Grundlage für den
 * manuellen Tausch. Umfasst der Dienst mehrere Pausen, muss die Person für
 * alle Zeitfenster verfügbar sein.
 */
export async function availableForDuty(date: string, slotIds: string[]) {
  await requirePlannerAction();
  const input = await loadSchedulerInput(date, date);
  const slots = input.slots.filter((s) => slotIds.includes(s.id));
  if (slots.length === 0) return [];
  const lookup = buildAvailabilityLookup(input.schoolTerms, input.absences);

  const taken = await db
    .select({ apprenticeId: assignments.apprenticeId })
    .from(assignments)
    .where(and(eq(assignments.date, date), inArray(assignments.slotId, slotIds)));
  const takenIds = new Set(taken.map((t) => t.apprenticeId));

  return input.apprentices
    .map((a) => {
      const blocked = slots
        .map((slot) => checkAvailability(a, date, slot, lookup))
        .find((check) => !check.available);
      return {
        id: a.id,
        name: a.displayName,
        available: !blocked,
        reason: blocked && !blocked.available ? blocked.reason : null,
        alreadyAssigned: takenIds.has(a.id),
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "de"));
}
