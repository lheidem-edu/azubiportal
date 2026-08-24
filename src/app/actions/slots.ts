"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { coverageSlots } from "@/db/schema";
import { fail, ok, requirePlannerAction, run, writeAudit } from "@/lib/action-utils";

function paths() {
  revalidatePath("/admin/coverage");
  revalidatePath("/planning");
  revalidatePath("/schedule");
}

const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Bitte eine Uhrzeit wie 09:00 angeben.");

const slotSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(30)
      .regex(/^[A-Z0-9_]+$/, "Nur Großbuchstaben, Ziffern und Unterstriche."),
    label: z.string().min(2, "Bitte eine Bezeichnung angeben."),
    kind: z.enum(["BREAK", "FULL_DAY"]).default("BREAK"),
    startTime: timeSchema,
    endTime: timeSchema,
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Mindestens ein Wochentag."),
    weight: z.coerce.number().min(0.1).max(20).default(1),
    backupCount: z.coerce.number().int().min(0).max(5).default(2),
    isActive: z.coerce.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(10),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "Das Ende muss nach dem Beginn liegen.",
    path: ["endTime"],
  });

export async function createSlot(input: unknown) {
  return run(async () => {
    const data = slotSchema.parse(input);
    const user = await requirePlannerAction();
    const [created] = await db
      .insert(coverageSlots)
      .values({ ...data, weight: String(data.weight) })
      .onConflictDoNothing({ target: coverageSlots.key })
      .returning();
    if (!created) return fail("Dieser Schlüssel ist bereits vergeben.");
    await writeAudit(user, "slot.create", "coverage_slot", created.id, data);
    paths();
    return ok(`„${data.label}" angelegt.`);
  });
}

export async function updateSlot(id: string, input: unknown) {
  return run(async () => {
    const data = slotSchema.parse(input);
    const user = await requirePlannerAction();
    const [updated] = await db
      .update(coverageSlots)
      .set({ ...data, weight: String(data.weight), updatedAt: new Date() })
      .where(eq(coverageSlots.id, id))
      .returning();
    if (!updated) return fail("Eintrag nicht gefunden.");
    await writeAudit(user, "slot.update", "coverage_slot", id, data);
    paths();
    return ok("Änderungen gespeichert. Neue Pläne berücksichtigen sie sofort.");
  });
}

export async function setSlotActive(id: string, isActive: boolean) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db
      .update(coverageSlots)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(coverageSlots.id, id));
    await writeAudit(user, "slot.active", "coverage_slot", id, { isActive });
    paths();
    return ok(isActive ? "Wird wieder geplant." : "Wird nicht mehr geplant.");
  });
}

export async function deleteSlot(id: string) {
  return run(async () => {
    const user = await requirePlannerAction();
    const entry = await db.query.coverageSlots.findFirst({ where: eq(coverageSlots.id, id) });
    if (!entry) return fail("Eintrag nicht gefunden.");
    await db.delete(coverageSlots).where(eq(coverageSlots.id, id));
    await writeAudit(user, "slot.delete", "coverage_slot", id, entry);
    paths();
    return ok(`„${entry.label}" wurde mit allen zugehörigen Einsätzen gelöscht.`);
  });
}
