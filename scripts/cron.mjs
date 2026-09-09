/**
 * Stößt eine zeitgesteuerte Aufgabe an – gedacht für die Schedules von Dokploy
 * oder einen beliebigen externen Cron.
 *
 *   node scripts/cron.mjs reminders
 *   node scripts/cron.mjs plan
 *
 * Der Aufruf geht standardmäßig an die Anwendung im selben Container. Bewusst
 * nicht an APP_BASE_URL: Die öffentliche Adresse zeigt auf den Reverse-Proxy
 * und ist von innen oft gar nicht auflösbar. Wer von außen anstößt, setzt
 * APP_INTERNAL_URL auf die erreichbare Adresse.
 */
import { describeError } from "./describe-error.mjs";

const job = process.argv[2] ?? "reminders";
const base = (
  process.env.APP_INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`
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
  console.error(`${job} Fehler:`, describeError(error));
  process.exit(1);
}
