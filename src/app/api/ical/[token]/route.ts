import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apprentices } from "@/db/schema";
import { addDays, today } from "@/lib/dates";
import { buildIcsFeed } from "@/lib/ics";
import { getUpcomingForApprentice } from "@/lib/scheduler/service";
import { getSetting } from "@/lib/settings";
import { APP_NAME } from "@/lib/app-config";

export const dynamic = "force-dynamic";

/**
 * Persönlicher Kalenderfeed. Die URL enthält ein zufälliges Token und ist
 * damit ohne Login abrufbar – so kann Outlook das Abo automatisch aktualisieren.
 * Das Token lässt sich im Profil jederzeit neu erzeugen.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = token.replace(/\.ics$/i, "");

  const apprentice = await db.query.apprentices.findFirst({
    where: eq(apprentices.icsToken, cleanToken),
  });
  if (!apprentice) {
    return new Response("Kalender nicht gefunden.", { status: 404 });
  }

  const url = new URL(request.url);
  const includeBackups = url.searchParams.get("backups") !== "0";
  const general = await getSetting("general");

  const from = addDays(today(), -60);
  const to = addDays(today(), 365);
  const entries = await getUpcomingForApprentice(apprentice.id, from, to);

  const ics = buildIcsFeed(entries, {
    calendarName: `${APP_NAME} – ${apprentice.displayName}`,
    includeBackups,
    baseUrl: process.env.APP_BASE_URL ?? url.origin,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="zentrale-${general.region.toLowerCase()}.ics"`,
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
