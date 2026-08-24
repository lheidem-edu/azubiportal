"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { deskShifts, deskStaff } from "@/db/schema";
import { fail, isoDateSchema, ok, requirePlannerAction, run, writeAudit } from "@/lib/action-utils";
import { weekdayLabel } from "@/lib/dates";

function paths() {
  revalidatePath("/admin/desk");
  revalidatePath("/absences");
  revalidatePath("/planning");
  revalidatePath("/schedule");
  revalidatePath("/");
}

const staffSchema = z.object({
  name: z.string().min(2, "Bitte einen Namen angeben."),
  email: z.union([z.email(), z.literal("")]).optional(),
  isActive: z.coerce.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export async function createDeskStaff(input: unknown) {
  return run(async () => {
    const data = staffSchema.parse(input);
    const user = await requirePlannerAction();
    const [created] = await db
      .insert(deskStaff)
      .values({
        name: data.name,
        email: data.email || null,
        isActive: data.isActive,
        notes: data.notes || null,
      })
      .returning();
    await writeAudit(user, "desk_staff.create", "desk_staff", created.id, data);
    paths();
    return ok(`${data.name} wurde angelegt.`);
  });
}

export async function updateDeskStaff(id: string, input: unknown) {
  return run(async () => {
    const data = staffSchema.parse(input);
    const user = await requirePlannerAction();
    const [updated] = await db
      .update(deskStaff)
      .set({
        name: data.name,
        email: data.email || null,
        isActive: data.isActive,
        notes: data.notes || null,
      })
      .where(eq(deskStaff.id, id))
      .returning();
    if (!updated) return fail("Eintrag nicht gefunden.");
    await writeAudit(user, "desk_staff.update", "desk_staff", id, data);
    paths();
    return ok("Änderungen gespeichert.");
  });
}

export async function deleteDeskStaff(id: string) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db.delete(deskStaff).where(eq(deskStaff.id, id));
    await writeAudit(user, "desk_staff.delete", "desk_staff", id);
    paths();
    return ok("Eintrag gelöscht.");
  });
}

const shiftSchema = z
  .object({
    staffId: z.string().uuid(),
    weekday: z.coerce.number().int().min(1).max(5),
    validFrom: isoDateSchema,
    validTo: isoDateSchema.optional().or(z.literal("")),
  })
  .refine((v) => !v.validTo || v.validFrom <= v.validTo, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["validTo"],
  });

/** Legt fest, wer an welchem Wochentag regulär in der Zentrale sitzt. */
export async function createDeskShift(input: unknown) {
  return run(async () => {
    const data = shiftSchema.parse(input);
    const user = await requirePlannerAction();

    const existing = await db
      .select()
      .from(deskShifts)
      .where(and(eq(deskShifts.staffId, data.staffId), eq(deskShifts.weekday, data.weekday)));
    const stillRunning = existing.some(
      (s) => !s.validTo || s.validTo >= (data.validTo || data.validFrom),
    );
    if (stillRunning) {
      return fail(`Für ${weekdayLabel(data.weekday)} ist bereits ein laufender Eintrag vorhanden.`);
    }

    const [created] = await db
      .insert(deskShifts)
      .values({
        staffId: data.staffId,
        weekday: data.weekday,
        validFrom: data.validFrom,
        validTo: data.validTo || null,
      })
      .returning();
    await writeAudit(user, "desk_shift.create", "desk_shift", created.id, data);
    paths();
    return ok(`${weekdayLabel(data.weekday)} zugeordnet.`);
  });
}

export async function deleteDeskShift(id: string) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db.delete(deskShifts).where(eq(deskShifts.id, id));
    await writeAudit(user, "desk_shift.delete", "desk_shift", id);
    paths();
    return ok("Zuordnung entfernt.");
  });
}
