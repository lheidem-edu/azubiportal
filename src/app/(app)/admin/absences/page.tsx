import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlanner } from "@/lib/session";
import { today } from "@/lib/dates";
import { listAbsences, listPeople } from "@/app/actions/absences";
import { AbsenceForm } from "@/app/(app)/absences/absence-form";
import { AbsenceList } from "@/app/(app)/absences/absence-list";

export const metadata = { title: "Abwesenheiten" };

export default async function AbsencesAdminPage() {
  await requirePlanner();

  const [rows, people] = await Promise.all([listAbsences(), listPeople()]);

  const pending = rows.filter((row) => row.status === "PENDING");
  const current = rows.filter((row) => row.status !== "PENDING" && row.endDate >= today());
  const past = rows.filter((row) => row.status !== "PENDING" && row.endDate < today());

  return (
    <>
      <PageHeader
        title="Abwesenheiten"
        description="Alle Abwesenheiten an einer Stelle – Auszubildende wie feste Zentrale-Besetzung."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Offene Anträge
                {pending.length > 0 && <Badge>{pending.length}</Badge>}
              </CardTitle>
              <CardDescription>
                Genehmigte Zeiträume werden bei der Planung sofort berücksichtigt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AbsenceList rows={pending} showPerson canDecide />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Laufend und kommend</CardTitle>
            </CardHeader>
            <CardContent>
              <AbsenceList rows={current} showPerson canDecide />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vergangen</CardTitle>
            </CardHeader>
            <CardContent>
              <AbsenceList rows={past.slice(0, 50)} showPerson />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Neuer Eintrag</CardTitle>
            <CardDescription>Gilt sofort, ohne Genehmigung.</CardDescription>
          </CardHeader>
          <CardContent>
            <AbsenceForm people={people} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
