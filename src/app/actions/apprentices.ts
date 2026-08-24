"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { apprentices, users } from "@/db/schema";
import {
  currentUser,
  fail,
  isoDateSchema,
  ok,
  requireAdminAction,
  requirePlannerAction,
  run,
  writeAudit,
} from "@/lib/action-utils";
import { newIcsToken } from "@/lib/auth";

const apprenticeSchema = z.object({
  displayName: z.string().min(2, "Bitte einen Namen angeben."),
  email: z.email("Bitte eine gültige E-Mail-Adresse angeben."),
  shortName: z.string().max(20).optional(),
  department: z.string().max(80).optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional().or(z.literal("")),
  isPlannable: z.coerce.boolean().default(true),
  loadFactor: z.coerce.number().min(0.1).max(3).default(1),
  loadOffset: z.coerce.number().min(-999).max(999).default(0),
  notifyEmail: z.coerce.boolean().default(true),
  notifyTeams: z.coerce.boolean().default(false),
  teamsWebhookUrl: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

function paths() {
  revalidatePath("/admin/apprentices");
  revalidatePath("/planning");
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function createApprentice(input: unknown) {
  return run(async () => {
    const data = apprenticeSchema.parse(input);
    const user = await requirePlannerAction();
    const email = data.email.toLowerCase();

    const existing = await db.query.apprentices.findFirst({
      where: sql`lower(${apprentices.email}) = ${email}`,
    });
    if (existing) return fail("Für diese E-Mail-Adresse gibt es bereits einen Eintrag.");

    // Vorhandenes Benutzerkonto gleicher Adresse direkt verknüpfen
    const account = await db.query.users.findFirst({ where: eq(users.email, email) });

    const [created] = await db
      .insert(apprentices)
      .values({
        userId: account?.id ?? null,
        displayName: data.displayName,
        shortName: data.shortName || null,
        email,
        department: data.department || null,
        startDate: data.startDate,
        endDate: data.endDate || null,
        isPlannable: data.isPlannable,
        loadFactor: String(data.loadFactor),
        loadOffset: String(data.loadOffset),
        notifyEmail: data.notifyEmail,
        notifyTeams: data.notifyTeams,
        teamsWebhookUrl: data.teamsWebhookUrl || null,
        notes: data.notes || null,
        icsToken: newIcsToken(),
      })
      .returning();

    await writeAudit(user, "apprentice.create", "apprentice", created.id, data);
    paths();
    return ok(`${data.displayName} wurde angelegt.`);
  });
}

export async function updateApprentice(id: string, input: unknown) {
  return run(async () => {
    const data = apprenticeSchema.parse(input);
    const user = await requirePlannerAction();

    const [updated] = await db
      .update(apprentices)
      .set({
        displayName: data.displayName,
        shortName: data.shortName || null,
        email: data.email.toLowerCase(),
        department: data.department || null,
        startDate: data.startDate,
        endDate: data.endDate || null,
        isPlannable: data.isPlannable,
        loadFactor: String(data.loadFactor),
        loadOffset: String(data.loadOffset),
        notifyEmail: data.notifyEmail,
        notifyTeams: data.notifyTeams,
        teamsWebhookUrl: data.teamsWebhookUrl || null,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(apprentices.id, id))
      .returning();
    if (!updated) return fail("Eintrag nicht gefunden.");

    await writeAudit(user, "apprentice.update", "apprentice", id, data);
    paths();
    return ok("Änderungen gespeichert.");
  });
}

/**
 * Auszubildende werden nicht gelöscht, sondern aus der Planung genommen –
 * damit bleiben vergangene Einsätze und der Lastenausgleich nachvollziehbar.
 */
export async function setApprenticePlannable(id: string, isPlannable: boolean) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db
      .update(apprentices)
      .set({ isPlannable, updatedAt: new Date() })
      .where(eq(apprentices.id, id));
    await writeAudit(user, "apprentice.plannable", "apprentice", id, { isPlannable });
    paths();
    return ok(isPlannable ? "Wird wieder eingeplant." : "Wird nicht mehr eingeplant.");
  });
}

export async function deleteApprentice(id: string) {
  return run(async () => {
    const user = await requireAdminAction();
    const entry = await db.query.apprentices.findFirst({ where: eq(apprentices.id, id) });
    if (!entry) return fail("Eintrag nicht gefunden.");

    await db.delete(apprentices).where(eq(apprentices.id, id));
    await writeAudit(user, "apprentice.delete", "apprentice", id, entry);
    paths();
    return ok(`${entry.displayName} wurde mit allen Einsätzen gelöscht.`);
  });
}

/** Erzeugt die Kalender-URL neu – die alte Adresse wird damit ungültig. */
export async function regenerateIcsToken(apprenticeId: string) {
  return run(async () => {
    const user = await currentUser();
    const entry = await db.query.apprentices.findFirst({
      where: eq(apprentices.id, apprenticeId),
    });
    if (!entry) return fail("Eintrag nicht gefunden.");
    if (user.apprenticeId !== apprenticeId && user.role === "APPRENTICE") {
      return fail("Du darfst nur deinen eigenen Kalender zurücksetzen.");
    }

    const token = newIcsToken();
    await db
      .update(apprentices)
      .set({ icsToken: token, updatedAt: new Date() })
      .where(eq(apprentices.id, apprenticeId));
    await writeAudit(user, "apprentice.ics_reset", "apprentice", apprenticeId);
    revalidatePath("/my-schedule");
    return ok("Neue Kalender-Adresse erzeugt.", { token });
  });
}

/** Rollenvergabe – nur für Administratoren. */
export async function setUserRole(userId: string, role: "ADMIN" | "PLANNER" | "APPRENTICE" | "DESK") {
  return run(async () => {
    const user = await requireAdminAction();
    if (userId === user.id) return fail("Die eigene Rolle kann nicht geändert werden.");

    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    await writeAudit(user, "user.role", "user", userId, { role });
    revalidatePath("/admin/settings");
    return ok("Rolle geändert.");
  });
}

export async function setUserActive(userId: string, isActive: boolean) {
  return run(async () => {
    const user = await requireAdminAction();
    if (userId === user.id) return fail("Das eigene Konto kann nicht deaktiviert werden.");

    await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
    await writeAudit(user, "user.active", "user", userId, { isActive });
    revalidatePath("/admin/settings");
    return ok(isActive ? "Zugang aktiviert." : "Zugang gesperrt.");
  });
}
