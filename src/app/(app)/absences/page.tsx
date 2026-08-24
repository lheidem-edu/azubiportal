import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deskShifts } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/session";
import { canPlan } from "@/lib/labels";
import { weekdayLabel } from "@/lib/dates";
import { listAbsences, listPeople } from "@/app/actions/absences";
import { personValue } from "@/lib/people";
import { AbsenceForm } from "./absence-form";
import { AbsenceList } from "./absence-list";

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

  const [people, rows, shifts] = await Promise.all([
    listPeople(),
    listAbsences({ personId: ownId }),
    ownKind === "DESK"
      ? db.select().from(deskShifts).where(eq(deskShifts.staffId, ownId))
      : Promise.resolve([]),
  ]);

  const weekdays = [...new Set(shifts.map((s) => s.weekday))].sort();
  const description =
    ownKind === "DESK"
      ? weekdays.length > 0
        ? `Du bist ${weekdays.map(weekdayLabel).join(", ")} in der Zentrale eingeteilt. An deinen Abwesenheitstagen wird eine ganztägige Vertretung eingeplant.`
        : "An deinen Abwesenheitstagen wird eine ganztägige Vertretung eingeplant."
      : "Urlaub muss von der Ausbildungsleitung genehmigt werden. Krankmeldungen gelten sofort.";

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
    </>
  );
}
