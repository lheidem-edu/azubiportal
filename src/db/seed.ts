import "@/lib/load-env";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  apprentices,
  companyClosures,
  coverageSlots,
  deskShifts,
  deskStaff,
  schoolTerms,
  settings,
  users,
} from "@/db/schema";
import { SETTINGS_SCHEMAS } from "@/lib/settings";
import { addDays, today } from "@/lib/dates";

const withDemo = process.argv.includes("--demo");

function icsToken() {
  return randomBytes(24).toString("base64url");
}

async function seedSlots() {
  const defaults = [
    {
      key: "BREAKFAST",
      label: "Frühstückspause",
      kind: "BREAK" as const,
      startTime: "09:00",
      endTime: "09:30",
      weight: "1.00",
      backupCount: 2,
      sortOrder: 10,
    },
    {
      key: "LUNCH",
      label: "Mittagspause",
      kind: "BREAK" as const,
      startTime: "12:00",
      endTime: "12:45",
      weight: "1.00",
      backupCount: 2,
      sortOrder: 20,
    },
    {
      key: "FULL_DAY",
      label: "Ganztägige Vertretung",
      kind: "FULL_DAY" as const,
      startTime: "08:00",
      endTime: "17:00",
      weight: "4.00",
      backupCount: 2,
      sortOrder: 30,
    },
  ];
  for (const slot of defaults) {
    await db.insert(coverageSlots).values(slot).onConflictDoNothing({ target: coverageSlots.key });
  }
  console.log(`✓ Vertretungs-Slots (${defaults.length})`);
}

async function seedSettings() {
  for (const key of Object.keys(SETTINGS_SCHEMAS) as (keyof typeof SETTINGS_SCHEMAS)[]) {
    await db
      .insert(settings)
      .values({ key, value: SETTINGS_SCHEMAS[key].parse({}) })
      .onConflictDoNothing({ target: settings.key });
  }
  console.log("✓ Standardeinstellungen");
}

async function seedDeskStaff() {
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(deskStaff);
  if (existing[0].n > 0) {
    console.log("• Zentrale-Besetzung bereits vorhanden – übersprungen");
    return;
  }
  const validFrom = `${new Date().getFullYear()}-01-01`;
  const [personA] = await db
    .insert(deskStaff)
    .values({ name: "Zentrale Mo–Mi", email: null })
    .returning();
  const [personB] = await db
    .insert(deskStaff)
    .values({ name: "Zentrale Do–Fr", email: null })
    .returning();

  await db.insert(deskShifts).values([
    { staffId: personA.id, weekday: 1, validFrom },
    { staffId: personA.id, weekday: 2, validFrom },
    { staffId: personA.id, weekday: 3, validFrom },
    { staffId: personB.id, weekday: 4, validFrom },
    { staffId: personB.id, weekday: 5, validFrom },
  ]);
  console.log("✓ Zentrale-Besetzung (Mo–Mi / Do–Fr) – Namen bitte in der Verwaltung anpassen");
}

async function seedDemo() {
  const demoPeople = [
    { name: "Anna Becker", email: "anna.becker@example.com", school: [1] },
    { name: "Ben Hoffmann", email: "ben.hoffmann@example.com", school: [2] },
    { name: "Clara Vogt", email: "clara.vogt@example.com", school: [4] },
    { name: "David Krüger", email: "david.krueger@example.com", school: [3, 5] },
    { name: "Emre Yildiz", email: "emre.yildiz@example.com", school: [2] },
  ];
  const start = `${new Date().getFullYear() - 1}-08-01`;

  for (const person of demoPeople) {
    const [user] = await db
      .insert(users)
      .values({ email: person.email, name: person.name, role: "APPRENTICE" })
      .onConflictDoNothing({ target: users.email })
      .returning();
    const userId =
      user?.id ??
      (await db.select().from(users).where(eq(users.email, person.email)).limit(1))[0]?.id;

    const [apprentice] = await db
      .insert(apprentices)
      .values({
        userId,
        displayName: person.name,
        email: person.email,
        startDate: start,
        endDate: null,
        icsToken: icsToken(),
      })
      .onConflictDoNothing({ target: apprentices.userId })
      .returning();
    if (!apprentice) continue;

    await db.insert(schoolTerms).values(
      person.school.map((weekday) => ({
        apprenticeId: apprentice.id,
        weekday,
        validFrom: start,
        note: "Berufsschule",
      })),
    );
  }

  const closureStart = addDays(today(), 60);
  await db
    .insert(companyClosures)
    .values({
      name: "Betriebsferien (Beispiel)",
      startDate: closureStart,
      endDate: addDays(closureStart, 9),
      blocksPlanning: true,
    })
    .onConflictDoNothing();

  console.log(`✓ Demodaten (${demoPeople.length} Auszubildende, 1 Betriebsferien-Eintrag)`);
}

async function main() {
  console.log("Grunddaten werden angelegt …\n");
  await seedSlots();
  await seedSettings();
  await seedDeskStaff();
  if (withDemo) await seedDemo();
  console.log("\nFertig.");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
