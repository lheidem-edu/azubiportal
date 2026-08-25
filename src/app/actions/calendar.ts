"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companyClosures, publicHolidays, schoolHolidays } from "@/db/schema";
import {
  fail,
  isoDateSchema,
  ok,
  requirePlannerAction,
  run,
  writeAudit,
} from "@/lib/action-utils";
import { nrwHolidays } from "@/lib/holidays";
import { importNrwSchoolHolidays } from "@/lib/calendar";
import { formatRangeDe } from "@/lib/dates";

function paths() {
  revalidatePath("/admin/calendar");
  revalidatePath("/planning");
  revalidatePath("/schedule");
}

const holidaySchema = z.object({
  date: isoDateSchema,
  name: z.string().min(2, "Bitte eine Bezeichnung angeben."),
  region: z.string().default("NRW"),
});

export async function createHoliday(input: unknown) {
  return run(async () => {
    const data = holidaySchema.parse(input);
    const user = await requirePlannerAction();
    const [created] = await db
      .insert(publicHolidays)
      .values({ ...data, source: "MANUAL" })
      .onConflictDoNothing()
      .returning();
    if (!created) return fail("Für diesen Tag gibt es bereits einen Eintrag.");
    await writeAudit(user, "holiday.create", "public_holiday", created.id, data);
    paths();
    return ok("Feiertag ergänzt.");
  });
}

/**
 * Schaltet einen Feiertag an oder ab. Gesetzliche Feiertage werden berechnet
 * und stehen nicht zwingend in der Tabelle – für sie wird beim Abschalten ein
 * Eintrag angelegt, der die Berechnung überstimmt.
 */
export async function setHolidayActive(date: string, isActive: boolean, region = "NRW") {
  return run(async () => {
    const user = await requirePlannerAction();
    const parsedDate = isoDateSchema.parse(date);

    const existing = await db.query.publicHolidays.findFirst({
      where: and(eq(publicHolidays.date, parsedDate), eq(publicHolidays.region, region)),
    });

    if (existing) {
      await db
        .update(publicHolidays)
        .set({ isActive })
        .where(eq(publicHolidays.id, existing.id));
    } else {
      if (isActive) return ok("Der Tag gilt bereits als Feiertag.");
      const computed = nrwHolidays(Number(parsedDate.slice(0, 4))).find(
        (h) => h.date === parsedDate,
      );
      if (!computed) return fail("Für diesen Tag gibt es keinen Feiertag zum Abschalten.");
      await db.insert(publicHolidays).values({
        date: parsedDate,
        name: computed.name,
        region,
        source: "AUTO",
        isActive: false,
      });
    }

    await writeAudit(user, "holiday.active", "public_holiday", parsedDate, { isActive });
    paths();
    return ok(isActive ? "Wird wieder als Feiertag behandelt." : "Wird nicht mehr berücksichtigt.");
  });
}

/**
 * Entfernt die Anpassung für einen Tag: Selbst eingetragene Feiertage
 * verschwinden, gesetzliche gelten danach wieder wie berechnet.
 */
export async function resetHoliday(date: string, region = "NRW") {
  return run(async () => {
    const user = await requirePlannerAction();
    const parsedDate = isoDateSchema.parse(date);

    const removed = await db
      .delete(publicHolidays)
      .where(and(eq(publicHolidays.date, parsedDate), eq(publicHolidays.region, region)))
      .returning({ source: publicHolidays.source });
    if (removed.length === 0) return fail("Für diesen Tag gibt es nichts zurückzusetzen.");

    await writeAudit(user, "holiday.reset", "public_holiday", parsedDate);
    paths();
    return ok(
      removed[0].source === "MANUAL"
        ? "Eintrag gelöscht."
        : "Anpassung zurückgenommen – es gilt wieder der gesetzliche Feiertag.",
    );
  });
}

const closureSchema = z
  .object({
    name: z.string().min(2, "Bitte eine Bezeichnung angeben."),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    blocksPlanning: z.coerce.boolean().default(true),
    note: z.string().max(300).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["endDate"],
  });

export async function createClosure(input: unknown) {
  return run(async () => {
    const data = closureSchema.parse(input);
    const user = await requirePlannerAction();
    const [created] = await db
      .insert(companyClosures)
      .values({ ...data, note: data.note || null })
      .returning();
    await writeAudit(user, "closure.create", "company_closure", created.id, data);
    paths();
    return ok(`Betriebsferien ${formatRangeDe(data.startDate, data.endDate)} eingetragen.`);
  });
}

export async function deleteClosure(id: string) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db.delete(companyClosures).where(eq(companyClosures.id, id));
    await writeAudit(user, "closure.delete", "company_closure", id);
    paths();
    return ok("Eintrag gelöscht.");
  });
}

/* -------------------------------------------------------------------------- */
/* Schulferien                                                                */
/* -------------------------------------------------------------------------- */

/** Liest die mitgelieferte Ferienordnung ein; vorhandene Einträge bleiben. */
export async function importSchoolHolidays() {
  return run(async () => {
    const user = await requirePlannerAction();
    const result = await importNrwSchoolHolidays();
    await writeAudit(user, "school_holidays.import", "school_holiday", undefined, result);
    paths();
    return ok(
      result.created > 0
        ? `${result.created} Ferienzeiträume ergänzt.`
        : "Alle hinterlegten Ferientermine waren bereits vorhanden.",
    );
  });
}

const schoolHolidaySchema = z
  .object({
    name: z.string().min(2, "Bitte eine Bezeichnung angeben."),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["endDate"],
  });

export async function createSchoolHoliday(input: unknown) {
  return run(async () => {
    const data = schoolHolidaySchema.parse(input);
    const user = await requirePlannerAction();
    const [created] = await db
      .insert(schoolHolidays)
      .values({ ...data, region: "NRW", source: "MANUAL" })
      .onConflictDoNothing()
      .returning();
    if (!created) return fail("Für diesen Zeitraum gibt es bereits einen Eintrag.");
    await writeAudit(user, "school_holiday.create", "school_holiday", created.id, data);
    paths();
    return ok("Ferien ergänzt.");
  });
}

export async function deleteSchoolHoliday(id: string) {
  return run(async () => {
    const user = await requirePlannerAction();
    await db.delete(schoolHolidays).where(eq(schoolHolidays.id, id));
    await writeAudit(user, "school_holiday.delete", "school_holiday", id);
    paths();
    return ok("Ferien entfernt. In diesem Zeitraum gelten die Berufsschultage wieder.");
  });
}
