import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { deskShifts } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/session";
import { canPlan } from "@/lib/labels";
import { today, weekdayLabel } from "@/lib/dates";
import { getYearOverview } from "@/lib/year-overview";
import { listAbsences, listPeople } from "@/app/actions/absences";
import { personValue, type PersonKind, type PersonOption } from "@/lib/people";
import { AbsenceForm } from "./absence-form";
import { AbsenceList } from "./absence-list";
import { PersonYearChart } from "./person-year-chart";

export const metadata = { title: "Urlaub & Abwesenheit" };

export default async function AbsencesPage() {
  const user = await requireUser();

  /**
   * Für welche Personen darf dieses Konto eintragen? Meist genau eine – an der
   * Zentrale kann ein Sammelkonto aber für mehrere Personen stehen.
   */
  const own: { kind: PersonKind; id: string }[] = [
    ...(user.apprenticeId ? [{ kind: "APPRENTICE" as const, id: user.apprenticeId }] : []),
    ...user.deskStaffIds.map((id) => ({ kind: "DESK" as const, id })),
  ];

  if (own.length === 0) {
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
  const ownIds = own.map((entry) => entry.id);
  const [allPeople, rows, shifts, overview] = await Promise.all([
    listPeople(),
    listAbsences({ personIds: ownIds }),
    user.deskStaffIds.length > 0
      ? db.select().from(deskShifts).where(inArray(deskShifts.staffId, user.deskStaffIds))
      : Promise.resolve([]),
    getYearOverview(year),
  ]);

  // Planungsverantwortliche dürfen für alle eintragen, alle anderen nur für sich.
  const selectable: PersonOption[] = canPlan(user.role)
    ? allPeople
    : allPeople.filter((person) =>
        own.some((entry) => entry.kind === person.kind && entry.id === person.id),
      );

  const mine = overview.people.filter((person) =>
    own.some((entry) => entry.kind === person.kind && entry.id === person.id),
  );

  const weekdays = [...new Set(shifts.map((s) => s.weekday))].sort();
  const isDesk = user.deskStaffIds.length > 0;
  const sharedAccount = user.deskStaffIds.length > 1;

  const description = isDesk
    ? weekdays.length > 0
      ? `In der Zentrale ist ${weekdays.map(weekdayLabel).join(", ")} besetzt. An Abwesenheitstagen wird eine ganztägige Vertretung eingeplant.`
      : "An Abwesenheitstagen wird eine ganztägige Vertretung eingeplant."
    : "Der Eintrag gilt sofort – an diesen Tagen wirst du nicht für die Zentrale eingeplant.";

  return (
    <>
      <PageHeader
        title="Urlaub & Abwesenheit"
        description="Trage hier ein, wann du nicht da bist. Diese Tage werden bei der Vertretungsplanung automatisch berücksichtigt."
      />

      {sharedAccount && (
        <Alert className="mb-6">
          <AlertDescription>
            Dieses Konto steht für mehrere Personen an der Zentrale. Wähle beim Eintragen aus, für
            wen der Eintrag gilt.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Neuer Eintrag</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <AbsenceForm
              people={selectable}
              defaultPerson={personValue(own[0].kind, own[0].id)}
              lockPerson={selectable.length === 1}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {sharedAccount ? "Einträge dieser Zentrale" : "Meine Einträge"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceList rows={rows} showPerson={sharedAccount} />
          </CardContent>
        </Card>
      </div>

      {mine.map((person) => (
        <Card key={`${person.kind}:${person.id}`} className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <CardTitle className="flex items-center gap-2 text-base">
                {sharedAccount || mine.length > 1 ? person.name : "Mein Jahr"} {year}
                {person.kind === "DESK" && (
                  <Badge variant="secondary" className="h-5">
                    Zentrale
                  </Badge>
                )}
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                {dayCount(person.vacationDays, "Urlaubstag", "Urlaubstage")} ·{" "}
                {dayCount(person.sickDays, "Krankheitstag", "Krankheitstage")}
              </p>
            </div>
            <CardDescription>
              Eine Zeile je Monat, eine Spalte je Tag. Seitlich scrollen, wenn der Monat nicht ganz
              aufs Bild passt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PersonYearChart overview={overview} person={person} today={today()} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

/** „1 Urlaubstag“, aber „2 Urlaubstage“ – halbe Tage bleiben im Plural. */
function dayCount(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString("de-DE")} ${value === 1 ? singular : plural}`;
}
