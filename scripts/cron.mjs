/**
 * Stößt eine zeitgesteuerte Aufgabe an – gedacht für die Schedules von Dokploy
 * oder einen beliebigen externen Cron.
 *
 *   node scripts/cron.mjs reminders
 *   node scripts/cron.mjs plan
 *
 * Läuft der Aufruf im selben Container wie die Anwendung, genügt die
 * Voreinstellung http://127.0.0.1:3000. Von außen setzt man APP_INTERNAL_URL
 * bzw. APP_BASE_URL auf die öffentliche Adresse.
 */
const job = process.argv[2] ?? "reminders";
const base = (
  process.env.APP_INTERNAL_URL ??
  process.env.APP_BASE_URL ??
  `http://127.0.0.1:${process.env.PORT ?? 3000}`
).replace(/\/$/, "");

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET ist nicht gesetzt.");
  process.exit(1);
}

try {
  const response = await fetch(`${base}/api/cron?job=${encodeURIComponent(job)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(180_000),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`${job} fehlgeschlagen (${response.status}): ${body}`);
    process.exit(1);
  }
  console.log(`${job}: ${body}`);
} catch (error) {
  console.error(`${job} Fehler:`, error?.message ?? error);
  process.exit(1);
}
