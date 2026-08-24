import Link from "next/link";
import { db } from "@/db";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdmin } from "@/lib/auth";
import { requirePlanner } from "@/lib/session";
import { today } from "@/lib/dates";
import { ApprenticeDialog } from "./apprentice-dialog";
import { ApprenticeTable, type ApprenticeRow } from "./apprentice-table";
import { SchoolTermForm, SchoolTermList } from "@/app/(app)/school/school-terms";

export const metadata = { title: "Auszubildende" };

export default async function ApprenticesAdminPage() {
  const user = await requirePlanner();

  const people = await db.query.apprentices.findMany({
    with: { schoolTerms: true },
    orderBy: (a, { asc }) => [asc(a.displayName)],
  });

  const rows: ApprenticeRow[] = people.map((person) => ({
    id: person.id,
    displayName: person.displayName,
    email: person.email,
    shortName: person.shortName ?? "",
    department: person.department ?? "",
    startDate: person.startDate,
    endDate: person.endDate ?? "",
    isPlannable: person.isPlannable,
    loadFactor: Number(person.loadFactor),
    loadOffset: Number(person.loadOffset),
    notifyEmail: person.notifyEmail,
    notifyTeams: person.notifyTeams,
    teamsWebhookUrl: person.teamsWebhookUrl ?? "",
    notes: person.notes ?? "",
    hasAccount: Boolean(person.userId),
    schoolWeekdays: [
      ...new Set(
        person.schoolTerms
          .filter((term) => !term.validTo || term.validTo >= today())
          .map((term) => term.weekday),
      ),
    ].sort(),
  }));

  const options = people.map((p) => ({ id: p.id, name: p.displayName }));
  const allTerms = people.flatMap((person) =>
    person.schoolTerms.map((term) => ({
      ...term,
      apprenticeName: person.displayName,
    })),
  );

  return (
    <>
      <PageHeader
        title="Auszubildende"
        description="Wer nimmt an der Vertretungsplanung teil – inklusive Ausbildungszeitraum und Benachrichtigungen."
        actions={<ApprenticeDialog />}
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <ApprenticeTable rows={rows} canDelete={isAdmin(user.role)} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schultag hinterlegen</CardTitle>
          <CardDescription>
            Auszubildende können ihre Schultage auch selbst pflegen. Urlaub und Krankmeldungen
            stehen unter{" "}
            <Link href="/admin/absences" className="underline underline-offset-4">
              Abwesenheiten
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolTermForm apprenticeId={null} apprenticeOptions={options} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alle Schultage</CardTitle>
        </CardHeader>
        <CardContent>
          <SchoolTermList rows={allTerms} showApprentice />
        </CardContent>
      </Card>
    </>
  );
}
