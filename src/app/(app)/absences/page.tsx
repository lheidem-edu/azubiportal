import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deskShifts } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/session";
import { canPlan } from "@/lib/labels";
import { today, weekdayLabel } from "@/lib/dates";
import { getYearOverview } from "@/lib/year-overview";
import { listAbsences, listPeople } from "@/app/actions/absences";
import { personValue } from "@/lib/people";
import { AbsenceForm } from "./absence-form";
import { AbsenceList } from "./absence-list";
import { PersonYearChart } from "./person-year-chart";

export const metadata = { title: "Urlaub & Abwesenheit" };

export default async function AbsencesPage() {
  const user = await requireUser();

  const ownKind = user.apprenticeId ? "APPRENTICE" : user.deskStaffId ? "DESK" : null;
  const ownId = user.apprenticeId ?? user.deskStaffId ?? null;

  if (!ownKind || !ownId) {
    return (
      <>
        <PageHeader title="Urlaub & Abwesenheit" />
        <Alert>
          <AlertDescription>
            Dein Konto ist noch keiner Person zugeordnet. Abwesenheiten anderer pflegst du in der
            Verwaltung.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const year = new Date().getFullYear();
  const [people, rows, shifts, overview] = await Promise.all([
    listPeople(),
    listAbsences({ personId: ownId }),
    ownKind === "DESK"
      ? db.select().from(deskShifts).where(eq(deskShifts.staffId, ownId))
      : Promise.resolve([]),
    getYearOverview(year),
  ]);

  const me = overview.people.find((person) => person.kind === ownKind && person.id === ownId);

  const weekdays = [...new Set(shifts.map((s) => s.weekday))].sort();
  const description =
    ownKind === "DESK"
      ? weekdays.length > 0
        ? `Du bist ${weekdays.map(weekdayLabel).join(", ")} in der Zentrale eingeteilt. An deinen Abwesenheitstagen wird eine ganztägige Vertretung eingeplant.`
        : "An deinen Abwesenheitstagen wird eine ganztägige Vertretung eingeplant."
      : "Der Eintrag gilt sofort – an diesen Tagen wirst du nicht für die Zentrale eingeplant.";

  return (
    <>
      <PageHeader
        title="Urlaub & Abwesenheit"
        description="Trage hier ein, wann du nicht da bist. Diese Tage werden bei der Vertretungsplanung automatisch berücksichtigt."
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Neuer Eintrag</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <AbsenceForm
              people={people}
              defaultPerson={personValue(ownKind, ownId)}
              lockPerson={!canPlan(user.role)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Meine Einträge</CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceList rows={rows} />
          </CardContent>
        </Card>
      </div>

      {me && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <CardTitle className="text-base">Mein Jahr {year}</CardTitle>
              <p className="text-muted-foreground text-xs">
                {dayCount(me.vacationDays, "Urlaubstag", "Urlaubstage")} ·{" "}
                {dayCount(me.sickDays, "Krankheitstag", "Krankheitstage")}
              </p>
            </div>
            <CardDescription>
              Eine Zeile je Monat, eine Spalte je Tag. Seitlich scrollen, wenn der Monat nicht
              ganz aufs Bild passt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PersonYearChart overview={overview} person={me} today={today()} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** „1 Urlaubstag“, aber „2 Urlaubstage“ – halbe Tage bleiben im Plural. */
function dayCount(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString("de-DE")} ${value === 1 ? singular : plural}`;
}
