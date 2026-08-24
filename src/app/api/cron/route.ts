import { NextResponse } from "next/server";
import { addDays, today } from "@/lib/dates";
import { dispatchDailyReminders } from "@/lib/notify";
import { applyPlan } from "@/lib/scheduler/service";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Einstiegspunkt für den Worker bzw. einen externen Cron.
 *
 *   POST /api/cron?job=reminders   – Morgenerinnerungen versenden
 *   POST /api/cron?job=plan        – Plan für den Planungshorizont erzeugen
 *
 * Feiertage brauchen keinen eigenen Lauf: Sie werden bei jeder Planung für
 * das jeweilige Jahr berechnet.
 *
 * Authentifizierung über `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const url = new URL(request.url);
  const job = url.searchParams.get("job") ?? "reminders";

  try {
    switch (job) {
      case "reminders": {
        const result = await dispatchDailyReminders(today(), {
          force: url.searchParams.get("force") === "1",
        });
        return NextResponse.json({ job, ...result });
      }
      case "plan": {
        const [general, planning] = await Promise.all([
          getSetting("general"),
          getSetting("planning"),
        ]);
        if (!planning.autoPlanEnabled) {
          return NextResponse.json({ job, skipped: "Automatischer Planlauf ist deaktiviert." });
        }
        const start = today();
        const end = addDays(start, general.planningHorizonDays);
        const result = await applyPlan(start, end, null);
        return NextResponse.json({
          job,
          rangeStart: start,
          rangeEnd: end,
          stats: result.stats,
          issues: result.issues,
        });
      }
      default:
        return NextResponse.json({ error: `Unbekannter Job: ${job}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`[cron:${job}]`, error);
    return NextResponse.json(
      { job, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
