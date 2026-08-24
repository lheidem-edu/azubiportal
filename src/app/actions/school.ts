"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { schoolTerms } from "@/db/schema";
import {
  assertCanEditApprentice,
  fail,
  isoDateSchema,
  ok,
  run,
  writeAudit,
} from "@/lib/action-utils";
import { weekdayLabel } from "@/lib/dates";

const schoolTermSchema = z
  .object({
    apprenticeId: z.string().uuid(),
    weekday: z.coerce.number().int().min(1).max(5),
    validFrom: isoDateSchema,
    validTo: isoDateSchema.optional().or(z.literal("")),
    intervalWeeks: z.coerce.number().int().min(1).max(4).default(1),
    anchorWeek: isoDateSchema.optional().or(z.literal("")),
    note: z.string().max(200).optional(),
  })
  .refine((v) => !v.validTo || v.validFrom <= v.validTo, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["validTo"],
  })
  .refine((v) => v.intervalWeeks === 1 || Boolean(v.anchorWeek), {
    message: "Bitte eine Startwoche für den Rhythmus angeben.",
    path: ["anchorWeek"],
  });

function paths() {
  revalidatePath("/school");
  revalidatePath("/admin/apprentices");
  revalidatePath("/planning");
}

export async function createSchoolTerm(input: unknown) {
  return run(async () => {
    const data = schoolTermSchema.parse(input);
    const user = await assertCanEditApprentice(data.apprenticeId);

    const [created] = await db
      .insert(schoolTerms)
      .values({
        apprenticeId: data.apprenticeId,
        weekday: data.weekday,
        validFrom: data.validFrom,
        validTo: data.validTo || null,
        intervalWeeks: data.intervalWeeks,
        anchorWeek: data.intervalWeeks > 1 ? data.anchorWeek || data.validFrom : null,
        note: data.note || null,
      })
      .returning();

    await writeAudit(user, "school.create", "school_term", created.id, data);
    paths();
    return ok(`${weekdayLabel(data.weekday)} als Schultag hinterlegt.`);
  });
}

export async function deleteSchoolTerm(id: string) {
  return run(async () => {
    const entry = await db.query.schoolTerms.findFirst({ where: eq(schoolTerms.id, id) });
    if (!entry) return fail("Eintrag nicht gefunden.");
    const user = await assertCanEditApprentice(entry.apprenticeId);

    await db.delete(schoolTerms).where(eq(schoolTerms.id, id));
    await writeAudit(user, "school.delete", "school_term", id, entry);
    paths();
    return ok("Schultag entfernt.");
  });
}

/** Beendet einen Schultag zum Stichtag, statt ihn zu löschen (Historie bleibt). */
export async function endSchoolTerm(id: string, validTo: string) {
  return run(async () => {
    const entry = await db.query.schoolTerms.findFirst({ where: eq(schoolTerms.id, id) });
    if (!entry) return fail("Eintrag nicht gefunden.");
    const user = await assertCanEditApprentice(entry.apprenticeId);

    await db.update(schoolTerms).set({ validTo }).where(eq(schoolTerms.id, id));
    await writeAudit(user, "school.end", "school_term", id, { validTo });
    paths();
    return ok("Zeitraum begrenzt.");
  });
}
