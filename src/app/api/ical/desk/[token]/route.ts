import { addDays, today } from "@/lib/dates";
import { buildMasterIcsFeed } from "@/lib/ics";
import { getPlanBoard } from "@/lib/scheduler/service";
import { getSetting } from "@/lib/settings";
import { APP_NAME } from "@/lib/app-config";

export const dynamic = "force-dynamic";

/**
 * Gesamtkalender der Zentrale – zum Abonnieren am Empfangsplatz. Zeigt für
 * jeden Tag, wer die Vertretung übernimmt, und in der Beschreibung, wer
 * ausgefallen ist und wer als Ersatz bereitsteht.
 *
 * Die Adresse enthält ein zufälliges Token; wer sie kennt, sieht den Plan.
 * Für einen Kalender am Empfang ist das angemessen, und das Token lässt sich
 * in der Verwaltung jederzeit neu erzeugen.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");

  const calendar = await getSetting("calendar");
  if (!calendar.deskFeedToken || clean !== calendar.deskFeedToken) {
    return new Response("Kalender nicht gefunden.", { status: 404 });
  }

  const url = new URL(request.url);
  const days = await getPlanBoard(addDays(today(), -30), addDays(today(), 180));

  const ics = buildMasterIcsFeed(days, {
    calendarName: `${APP_NAME} – Zentrale`,
    baseUrl: process.env.APP_BASE_URL ?? url.origin,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="zentrale.ics"',
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
