import "@/lib/load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertEnvironment } from "@/lib/env";

/**
 * Wendet die Migrationen an. Läuft im Container vor dem Serverstart, damit ein
 * Deployment ohne zusätzlichen Handgriff auskommt.
 */
async function main() {
  assertEnvironment();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool);

  // Beim ersten Start ist die Datenbank eventuell noch nicht bereit.
  const attempts = Number(process.env.MIGRATE_RETRIES ?? 10);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query("select 1");
      break;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`Datenbank noch nicht erreichbar (Versuch ${attempt}/${attempts}) …`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("Migrationen werden angewendet …");
  await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
  console.log("Datenbank ist auf dem aktuellen Stand.");
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
