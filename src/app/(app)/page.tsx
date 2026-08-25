import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { db } from "@/db";
import { absences, assignments, deskShifts } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addDays,
  formatDateDe,
  formatDateLongDe,
  formatTime,
  today,
  weekdayLabel,
  type IsoDate,
} from "@/lib/dates";
import { getPlanBoard, getUpcomingForApprentice, type BoardDay } from "@/lib/scheduler/service";
import { enumerateDe, rankLabel } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { canPlan } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { AwayTodayButton } from "./sick-today-button";

export const metadata = { title: "Start" };

export default async function DashboardPage() {
  const user = await requireUser();
  const day = today();
  const general = await getSetting("general");

  const [board, mine, planEnd, deskInfo] = await Promise.all([
    getPlanBoard(day, addDays(day, 6)),
    user.apprenticeId
      ? getUpcomingForApprentice(user.apprenticeId, day, addDays(day, 60))
      : Promise.resolve([]),
    db
      .select({ last: sql<IsoDate | null>`max(${assignments.date})` })
      .from(assignments)
      .then((r) => r[0].last),
    user.deskStaffId ? loadDeskInfo(user.deskStaffId, day) : Promise.resolve(null),
  ]);

  const todayBoard = board.find((d) => d.date === day);
  const upcomingGaps = board.filter(
    (d) => d.isWorkday && d.duties.some((duty) => duty.missingRanks.includes(1)),
  );
  const horizonEnd = addDays(day, general.planningHorizonDays);
  const planIncomplete = !planEnd || planEnd < addDays(day, 7);

  return (
    <>
      <PageHeader
        title={`Hallo ${user.name.split(" ")[0] || ""}`.trim()}
        description={formatDateLongDe(day)}
        actions={
          user.apprenticeId ? (
            <AwayTodayButton personKind="APPRENTICE" personId={user.apprenticeId} date={day} />
          ) : user.deskStaffId ? (
            <AwayTodayButton personKind="DESK" personId={user.deskStaffId} date={day} />
          ) : null
        }
      />

      {canPlan(user.role) && (planIncomplete || upcomingGaps.length > 0) && (
        <div className="mb-6 space-y-3">
          {planIncomplete && (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Der Plan reicht nicht weit genug</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>
                  {planEnd
                    ? `Aktuell ist bis ${formatDateDe(planEnd)} geplant.`
                    : "Es wurde noch kein Plan erzeugt."}{" "}
                  Vorgesehen ist ein Horizont bis {formatDateDe(horizonEnd)}.
                </span>
                <Button size="sm" asChild>
                  <Link href="/planning">Jetzt planen</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {upcomingGaps.length > 0 && (
            <Alert variant="destructive">
              <UserRoundX />
              <AlertTitle>Lücken in den nächsten 7 Tagen</AlertTitle>
              <AlertDescription>
                {upcomingGaps.map((d) => formatDateDe(d.date)).join(", ")} – hier fehlt eine
                Vertretung.{" "}
                <Link href="/planning" className="underline underline-offset-4">
                  Bearbeiten
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4" />
              Heute in der Zentrale
            </CardTitle>
            <CardDescription>
              {todayBoard?.isWorkday
                ? dutySummary(todayBoard)
                : (todayBoard?.holidayName ??
                  todayBoard?.closureName ??
                  todayBoard?.skipReason ??
                  "Kein Arbeitstag")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!todayBoard?.isWorkday ? (
              <p className="text-muted-foreground text-sm">Heute ist keine Vertretung nötig.</p>
            ) : (
              todayBoard.duties.map((duty) => (
                <div key={duty.key}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-medium">{duty.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {duty.times
                        .map((t) => `${formatTime(t.startTime)}–${formatTime(t.endTime)}`)
                        .join(" · ")}{" "}
                      Uhr
                    </span>
                  </div>
                  {duty.entries.length === 0 ? (
                    <p className="text-destructive text-sm">Niemand eingeteilt</p>
                  ) : (
                    <ul className="space-y-1">
                      {duty.entries.map((entry) => (
                        <li key={entry.rank} className="flex items-center justify-between gap-2">
                          <span
                            className={
                              entry.rank === 1
                                ? "text-sm font-medium"
                                : "text-muted-foreground text-sm"
                            }
                          >
                            {entry.apprenticeName}
                            {entry.apprenticeId === user.apprenticeId && (
                              <Badge variant="secondary" className="ml-2 h-5">
                                du
                              </Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {rankLabel(entry.rank)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {deskInfo ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4" />
                Meine Zentrale-Tage
              </CardTitle>
              <CardDescription>
                {deskInfo.weekdays.length > 0
                  ? deskInfo.weekdays.map(weekdayLabel).join(", ")
                  : "Dir ist noch kein Wochentag zugeordnet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">Kommende Abwesenheiten</div>
              {deskInfo.upcoming.length === 0 ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  Nichts eingetragen.{" "}
                  <Link href="/absences" className="underline underline-offset-4">
                    Abwesenheit melden
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {deskInfo.upcoming.map((entry) => (
                    <li key={entry.id} className="text-muted-foreground text-sm">
                      {formatDateDe(entry.startDate)}
                      {entry.endDate !== entry.startDate ? ` – ${formatDateDe(entry.endDate)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Meine nächsten Einsätze
            </CardTitle>
            <CardDescription>
              {user.apprenticeId
                ? "Die nächsten 60 Tage"
                : "Dein Konto ist keinem Auszubildenden zugeordnet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mine.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aktuell ist nichts für dich geplant.</p>
            ) : (
              <ul className="space-y-2">
                {mine.slice(0, 6).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm">{formatDateLongDe(entry.date)}</div>
                      <div className="text-muted-foreground text-xs">
                        {entry.slotLabel} · {formatTime(entry.startTime)}–
                        {formatTime(entry.endTime)} Uhr
                      </div>
                    </div>
                    <Badge variant={entry.rank === 1 ? "default" : "secondary"}>
                      {rankLabel(entry.rank)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {mine.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-3" asChild>
                <Link href="/my-schedule">
                  Alle Termine <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </>
  );
}

/**
 * Beschreibt einen Tag anhand der tatsächlich geplanten Dienste, statt eine
 * bestimmte Vertretungsart vorauszusetzen.
 */
function dutySummary(day: BoardDay): string {
  const labels = enumerateDe(day.duties.map((duty) => duty.label));
  if (day.requiresFullDay) {
    const missing = day.absentStaff.length > 0 ? day.absentStaff.join(", ") : "Festbesetzung";
    return `${labels || "Vertretung"} nötig – Ausfall: ${missing}`;
  }
  return labels || "Keine Vertretung nötig";
}

/** Wochentage und kommende Abwesenheiten der festen Zentrale-Besetzung. */
async function loadDeskInfo(staffId: string, from: IsoDate) {
  const [shifts, upcoming] = await Promise.all([
    db.select().from(deskShifts).where(eq(deskShifts.staffId, staffId)),
    db
      .select()
      .from(absences)
      .where(and(eq(absences.deskStaffId, staffId), gte(absences.endDate, from)))
      .orderBy(absences.startDate)
      .limit(5),
  ]);
  return {
    weekdays: [...new Set(shifts.map((s) => s.weekday))].sort(),
    upcoming,
  };
}
