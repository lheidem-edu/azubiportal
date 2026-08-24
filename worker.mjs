/**
 * Hintergrunddienst: stößt die zeitgesteuerten Aufgaben der Anwendung an.
 * Läuft als eigener Container neben der Web-App und ruft deren Cron-Endpunkt
 * auf – dadurch gibt es genau eine Stelle mit Geschäftslogik.
 */
import cron from "node-cron";

const BASE_URL = (process.env.APP_INTERNAL_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const TIMEZONE = process.env.TZ ?? "Europe/Berlin";

if (!SECRET) {
  console.error("CRON_SECRET ist nicht gesetzt – der Worker wird beendet.");
  process.exit(1);
}

async function runJob(job) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(`${BASE_URL}/api/cron?job=${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(120_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[${startedAt}] ${job} fehlgeschlagen (${response.status})`, body);
      return;
    }
    console.log(`[${startedAt}] ${job} ok`, JSON.stringify(body));
  } catch (error) {
    console.error(`[${startedAt}] ${job} Fehler:`, error?.message ?? error);
  }
}

const schedules = [
  { job: "reminders", expr: process.env.REMINDER_CRON ?? "0 7 * * 1-5" },
  { job: "plan", expr: process.env.PLANNING_CRON ?? "30 5 * * 1" },
];

for (const { job, expr } of schedules) {
  if (!cron.validate(expr)) {
    console.error(`Ungültiger Cron-Ausdruck für ${job}: ${expr}`);
    continue;
  }
  cron.schedule(expr, () => runJob(job), { timezone: TIMEZONE });
  console.log(`Geplant: ${job} → ${expr} (${TIMEZONE})`);
}

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
