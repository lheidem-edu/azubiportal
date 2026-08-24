"use server";

import { and, eq, gte, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { absences, apprentices, deskStaff } from "@/db/schema";
import {
  currentUser,
  fail,
  isoDateSchema,
  ok,
  requirePlannerAction,
  run,
  writeAudit,
} from "@/lib/action-utils";
import { canPlan } from "@/lib/labels";
import { formatRangeDe } from "@/lib/dates";
import type { SessionUser } from "@/lib/session";
import { personValue, type AbsenceRow, type PersonKind, type PersonOption } from "@/lib/people";

/* -------------------------------------------------------------------------- */
/* Personen                                                                   */
/* -------------------------------------------------------------------------- */

/** Alle Personen, für die Abwesenheiten erfasst werden können. */
export async function listPeople(): Promise<PersonOption[]> {
  const [apprenticeRows, staffRows] = await Promise.all([
    db
      .select({ id: apprentices.id, name: apprentices.displayName })
      .from(apprentices)
      .orderBy(apprentices.displayName),
    db
      .select({ id: deskStaff.id, name: deskStaff.name })
      .from(deskStaff)
      .orderBy(deskStaff.name),
  ]);
  return [
    ...apprenticeRows.map((r) => ({
      value: personValue("APPRENTICE", r.id),
      kind: "APPRENTICE" as const,
      id: r.id,
      name: r.name,
    })),
    ...staffRows.map((r) => ({
      value: personValue("DESK", r.id),
      kind: "DESK" as const,
      id: r.id,
      name: r.name,
    })),
  ];
}

/* -------------------------------------------------------------------------- */
/* Erfassen                                                                   */
/* -------------------------------------------------------------------------- */

const absenceSchema = z
  .object({
    personKind: z.enum(["APPRENTICE", "DESK"]),
    personId: z.string().uuid("Keine Person ausgewählt."),
    type: z.enum(["VACATION", "SICK", "SCHOOL_BLOCK", "TRAINING", "OTHER"]),
    dayPart: z.enum(["FULL", "MORNING", "AFTERNOON"]).default("FULL"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["endDate"],
  })
  .refine((v) => v.dayPart === "FULL" || v.startDate === v.endDate, {
    message: "Halbe Tage sind nur für einen einzelnen Tag möglich.",
    path: ["dayPart"],
  })
  .refine((v) => v.personKind === "APPRENTICE" || v.dayPart === "FULL", {
    message: "Für die Zentrale werden nur ganze Tage erfasst.",
    path: ["dayPart"],
  });

function paths() {
  revalidatePath("/absences");
  revalidatePath("/admin/absences");
  revalidatePath("/admin/desk");
  revalidatePath("/planning");
  revalidatePath("/schedule");
  revalidatePath("/");
}

/**
 * Prüft, ob der Benutzer für diese Person eintragen darf: für sich selbst
 * immer, für alle anderen nur mit Planungsverantwortung.
 */
async function assertCanEditPerson(kind: PersonKind, id: string): Promise<SessionUser> {
  const user = await currentUser();
  if (canPlan(user.role)) return user;
  if (kind === "APPRENTICE" && user.apprenticeId === id) return user;
  if (kind === "DESK" && user.deskStaffId === id) return user;
  throw new Error("Du darfst nur deine eigenen Abwesenheiten eintragen.");
}

export async function createAbsence(input: unknown) {
  return run(async () => {
    const data = absenceSchema.parse(input);
    const user = await assertCanEditPerson(data.personKind, data.personId);
    const subject =
      data.personKind === "APPRENTICE"
        ? { apprenticeId: data.personId, deskStaffId: null }
        : { apprenticeId: null, deskStaffId: data.personId };

    const overlapping = await db
      .select({ id: absences.id })
      .from(absences)
      .where(
        and(
          data.personKind === "APPRENTICE"
            ? eq(absences.apprenticeId, data.personId)
            : eq(absences.deskStaffId, data.personId),
          ne(absences.status, "REJECTED"),
          ne(absences.status, "CANCELLED"),
          lte(absences.startDate, data.endDate),
          gte(absences.endDate, data.startDate),
        ),
      );
    if (overlapping.length > 0) {
      return fail("Für diesen Zeitraum ist bereits eine Abwesenheit eingetragen.");
    }

    /**
     * Genehmigt werden müssen nur Urlaubsanträge der Auszubildenden.
     * Krankmeldungen, Einträge der Festbesetzung und alles, was die
     * Planungsverantwortlichen erfassen, gilt sofort.
     */
    const autoApprove =
      data.type === "SICK" || data.personKind === "DESK" || canPlan(user.role);

    const [created] = await db
      .insert(absences)
      .values({
        ...subject,
        type: data.type,
        dayPart: data.dayPart,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || null,
        status: autoApprove ? "APPROVED" : "PENDING",
        requestedBy: user.id,
        decidedBy: autoApprove ? user.id : null,
        decidedAt: autoApprove ? new Date() : null,
      })
      .returning();

    await writeAudit(user, "absence.create", "absence", created.id, data);
    paths();

    if (!autoApprove) {
      return ok(`Antrag für ${formatRangeDe(data.startDate, data.endDate)} eingereicht.`);
    }
    return ok(
      data.personKind === "DESK"
        ? `Eingetragen: ${formatRangeDe(data.startDate, data.endDate)}. Für diese Tage wird ganztägige Vertretung eingeplant.`
        : `Eingetragen: ${formatRangeDe(data.startDate, data.endDate)}.`,
    );
  });
}

export async function decideAbsence(input: {
  id: string;
  status: "APPROVED" | "REJECTED";
  note?: string;
}) {
  return run(async () => {
    const user = await requirePlannerAction();
    const [updated] = await db
      .update(absences)
      .set({
        status: input.status,
        decidedBy: user.id,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(absences.id, input.id))
      .returning();
    if (!updated) return fail("Eintrag nicht gefunden.");

    await writeAudit(user, `absence.${input.status.toLowerCase()}`, "absence", input.id);
    paths();
    return ok(input.status === "APPROVED" ? "Genehmigt." : "Abgelehnt.");
  });
}

export async function cancelAbsence(id: string) {
  return run(async () => {
    const entry = await db.query.absences.findFirst({ where: eq(absences.id, id) });
    if (!entry) return fail("Eintrag nicht gefunden.");

    const kind: PersonKind = entry.apprenticeId ? "APPRENTICE" : "DESK";
    const user = await assertCanEditPerson(kind, (entry.apprenticeId ?? entry.deskStaffId)!);

    // Genehmigten Urlaub dürfen Azubis nicht selbst zurückziehen; die eigene
    // Abwesenheit der Festbesetzung schon – sie war nie genehmigungspflichtig.
    if (kind === "APPRENTICE" && entry.status === "APPROVED" && !canPlan(user.role)) {
      return fail("Bereits genehmigte Einträge kann nur die Ausbildungsleitung entfernen.");
    }

    await db.delete(absences).where(eq(absences.id, id));
    await writeAudit(user, "absence.delete", "absence", id, entry);
    paths();
    return ok("Eintrag entfernt.");
  });
}

/** Schnellerfassung „heute nicht da" aus dem Dashboard. */
export async function reportAwayToday(kind: PersonKind, id: string, date: string) {
  return createAbsence({
    personKind: kind,
    personId: id,
    type: "SICK",
    dayPart: "FULL",
    startDate: date,
    endDate: date,
    reason: kind === "DESK" ? "Kurzfristige Abwesenheit" : "Krankmeldung",
  });
}

/* -------------------------------------------------------------------------- */
/* Abfragen                                                                   */
/* -------------------------------------------------------------------------- */

/** Abwesenheiten beider Personengruppen in einer Liste. */
export async function listAbsences(filter: {
  personKind?: PersonKind;
  personId?: string;
  from?: string;
} = {}): Promise<AbsenceRow[]> {
  const rows = await db
    .select({
      id: absences.id,
      apprenticeId: absences.apprenticeId,
      deskStaffId: absences.deskStaffId,
      apprenticeName: apprentices.displayName,
      staffName: deskStaff.name,
      type: absences.type,
      dayPart: absences.dayPart,
      startDate: absences.startDate,
      endDate: absences.endDate,
      status: absences.status,
      reason: absences.reason,
    })
    .from(absences)
    .leftJoin(apprentices, eq(absences.apprenticeId, apprentices.id))
    .leftJoin(deskStaff, eq(absences.deskStaffId, deskStaff.id))
    .where(
      and(
        filter.personKind === "APPRENTICE" ? isNotNull(absences.apprenticeId) : undefined,
        filter.personKind === "DESK" ? isNotNull(absences.deskStaffId) : undefined,
        filter.personId
          ? or(
              eq(absences.apprenticeId, filter.personId),
              eq(absences.deskStaffId, filter.personId),
            )
          : undefined,
        filter.from ? gte(absences.endDate, filter.from) : undefined,
      ),
    )
    .orderBy(sql`${absences.startDate} desc`);

  return rows.map((row) => ({
    id: row.id,
    personKind: row.apprenticeId ? "APPRENTICE" : "DESK",
    personId: (row.apprenticeId ?? row.deskStaffId)!,
    personName: row.apprenticeName ?? row.staffName ?? "—",
    type: row.type,
    dayPart: row.dayPart,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    reason: row.reason,
  }));
}
