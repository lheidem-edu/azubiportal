/**
 * Rolle eines Benutzers setzen – gedacht für den ersten Administrator und für
 * Notfälle, in denen sich niemand mehr in der Verwaltung anmelden kann.
 *
 *   npm run user:role                          alle Benutzer auflisten
 *   npm run user:role -- max@firma.de          Rolle ADMIN vergeben
 *   npm run user:role -- max@firma.de PLANNER  eine andere Rolle vergeben
 *
 * Bewusst ohne TypeScript und ohne Drizzle: So läuft der Befehl auch im
 * fertigen Abbild, wo weder tsx noch die Entwicklungsabhängigkeiten liegen –
 * etwa über „Run command" in Dokploy.
 */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { describeError } from "./describe-error.mjs";

/** Minimaler Ersatz für dotenv, damit der Befehl auch lokal funktioniert. */
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.trim().replace(/^["']|["']$/g, "");
    }
  }
}

const ROLES = ["ADMIN", "PLANNER", "APPRENTICE", "DESK"];
const ROLE_LABEL = {
  ADMIN: "Administrator",
  PLANNER: "Planungsverantwortlich",
  APPRENTICE: "Auszubildende:r",
  DESK: "Zentrale",
};

function printUsers(rows) {
  if (rows.length === 0) {
    console.log("Noch keine Benutzer vorhanden – sie entstehen bei der ersten Anmeldung.");
    return;
  }
  const width = Math.max(...rows.map((r) => r.email.length));
  console.log("");
  for (const row of rows) {
    const status = row.is_active ? "" : "  (gesperrt)";
    console.log(`  ${row.email.padEnd(width)}  ${ROLE_LABEL[row.role] ?? row.role}${status}`);
  }
  console.log("");
}

/**
 * Kein `process.exit()`: Auf eine Pipe – etwa in Dokploys „Run command" –
 * schreibt Node verzögert, und ein sofortiger Abbruch verwirft die Ausgabe.
 * Stattdessen wird der Rückgabewert gesetzt und regulär zu Ende gelaufen.
 */
async function main() {
  loadEnvFiles();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL ist nicht gesetzt.");
    return 1;
  }

  const [emailArg, roleArg] = process.argv.slice(2);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const allUsers = async () =>
      (await client.query("select email, role, is_active from users order by role, email")).rows;

    if (!emailArg) {
      printUsers(await allUsers());
      console.log("Rolle setzen:  npm run user:role -- <adresse> [ADMIN|PLANNER|APPRENTICE|DESK]");
      return 0;
    }

    const email = emailArg.trim().toLowerCase();
    const role = (roleArg ?? "ADMIN").trim().toUpperCase();

    if (!ROLES.includes(role)) {
      console.error(`Unbekannte Rolle „${roleArg}". Möglich sind: ${ROLES.join(", ")}`);
      return 1;
    }

    const { rows } = await client.query(
      "update users set role = $1, updated_at = now() where lower(email) = $2 returning email, role",
      [role, email],
    );

    if (rows.length === 0) {
      console.error(`Kein Benutzer mit der Adresse ${email}.`);
      console.error("Konten entstehen bei der ersten Anmeldung: Die Person muss sich einmal");
      console.error("anmelden, danach diesen Befehl erneut ausführen.");
      const users = await allUsers();
      if (users.length > 0) {
        console.error("\nVorhandene Benutzer:");
        printUsers(users);
      }
      return 1;
    }

    console.log(`${rows[0].email} hat jetzt die Rolle ${ROLE_LABEL[rows[0].role]}.`);
    return 0;
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(describeError(error));
  process.exitCode = 1;
}
