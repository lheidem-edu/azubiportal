import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { CalendarPlus } from "lucide-react";
import { db } from "@/db";
import { apprentices } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  addDays,
  formatDateLongDe,
  formatTime,
  isoWeekNumber,
  startOfIsoWeek,
  today,
} from "@/lib/dates";
import { getUpcomingForApprentice } from "@/lib/scheduler/service";
import { rankLabel } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { CalendarSubscription } from "./calendar-subscription";

export const metadata = { title: "Mein Plan" };

export default async function MyPlanPage() {
  const user = await requireUser();

  if (!user.apprenticeId) {
    return (
      <>
        <PageHeader title="Mein Plan" />
        <Alert>
          <AlertDescription>
            Dein Benutzerkonto ist noch keinem Auszubildenden zugeordnet. Bitte wende dich an die
            Ausbildungsleitung – sobald die Zuordnung besteht, erscheint hier dein Plan.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const apprentice = await db.query.apprentices.findFirst({
    where: eq(apprentices.id, user.apprenticeId),
  });
  if (!apprentice) return null;

  const from = today();
  const to = addDays(from, 120);
  const entries = await getUpcomingForApprentice(apprentice.id, from, to);
  const baseUrl = await publicBaseUrl();
  const primary = entries.filter((e) => e.rank === 1);
  const backup = entries.filter((e) => e.rank > 1);

  const byWeek = new Map<string, typeof entries>();
  for (const entry of entries) {
    const week = startOfIsoWeek(entry.date);
    const list = byWeek.get(week) ?? [];
    list.push(entry);
    byWeek.set(week, list);
  }

  return (
    <>
      <PageHeader
        title="Mein Plan"
        description="Deine Einteilungen für die Zentrale in den nächsten Wochen."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Vertretungen" value={primary.length} hint="in den nächsten 120 Tagen" />
        <StatCard label="Als Ersatz" value={backup.length} hint="springst du nur bei Ausfall ein" />
        <StatCard
          label="Nächster Einsatz"
          value={primary[0] ? formatDateLongDe(primary[0].date).split(",")[0] : "–"}
          hint={primary[0] ? formatDateLongDe(primary[0].date) : "aktuell nichts geplant"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {entries.length === 0 ? (
            <EmptyState
              title="Aktuell keine Einteilungen"
              description="Sobald der Plan erstellt wurde, erscheinen deine Termine hier automatisch."
            />
          ) : (
            [...byWeek.entries()].map(([week, list]) => (
              <Card key={week}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">KW {isoWeekNumber(week)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="text-sm font-medium">{formatDateLongDe(entry.date)}</div>
                        <div className="text-muted-foreground text-xs">
                          {entry.slotLabel} · {formatTime(entry.startTime)}–
                          {formatTime(entry.endTime)} Uhr
                        </div>
                      </div>
                      <Badge variant={entry.rank === 1 ? "default" : "secondary"}>
                        {rankLabel(entry.rank)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarPlus className="size-4" />
                In Outlook abonnieren
              </CardTitle>
              <CardDescription>
                Der Kalender aktualisiert sich automatisch, wenn sich der Plan ändert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarSubscription
                apprenticeId={apprentice.id}
                token={apprentice.icsToken}
                baseUrl={baseUrl}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * Adresse, unter der die Anwendung von außen erreichbar ist. Bevorzugt wird
 * APP_BASE_URL, ansonsten werden die Proxy-Header ausgewertet.
 */
async function publicBaseUrl() {
  const configured = process.env.APP_BASE_URL ?? process.env.AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-heading mt-1 text-2xl font-semibold">{value}</div>
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      </CardContent>
    </Card>
  );
}
