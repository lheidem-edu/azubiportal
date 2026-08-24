import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schoolTerms } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/session";
import { SchoolTermForm, SchoolTermList } from "./school-terms";

export const metadata = { title: "Schultage" };

export default async function SchoolPage() {
  const user = await requireUser();

  if (!user.apprenticeId) {
    return (
      <>
        <PageHeader title="Schultage" />
        <Alert>
          <AlertDescription>
            Dein Konto ist keinem Auszubildenden zugeordnet. Schultage anderer Personen pflegst du
            in der Verwaltung.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const rows = await db
    .select()
    .from(schoolTerms)
    .where(eq(schoolTerms.apprenticeId, user.apprenticeId))
    .orderBy(schoolTerms.weekday);

  return (
    <>
      <PageHeader
        title="Schultage"
        description="An Berufsschultagen wirst du nicht für die Zentrale eingeplant. Blockunterricht trägst du unter „Urlaub & Abwesenheit“ ein."
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Schultag hinterlegen</CardTitle>
            <CardDescription>
              Wiederkehrende Tage – auch im 14-tägigen Wechsel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchoolTermForm apprenticeId={user.apprenticeId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Meine Schultage</CardTitle>
          </CardHeader>
          <CardContent>
            <SchoolTermList rows={rows} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
