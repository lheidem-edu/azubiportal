import { db } from "@/db";
import { eq } from "drizzle-orm";
import { apprentices, companyClosures } from "@/db/schema";
import { listEffectiveHolidays, listSchoolHolidays } from "@/lib/calendar";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NRW_SCHOOL_HOLIDAYS_UNTIL } from "@/lib/school-holidays-nrw";
import { SchoolHolidayList, type SchoolHolidayRow } from "./school-holidays";
import { requirePlanner } from "@/lib/session";
import { CalendarManager, type ClosureRow, type HolidayRow } from "./calendar-manager";

export const metadata = { title: "Kalender" };

export default async function CalendarAdminPage(props: PageProps<"/admin/calendar">) {
  await requirePlanner();
  const params = await props.searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [holidays, closures, ferien, azubis] = await Promise.all([
    listEffectiveHolidays(`${year}-01-01`, `${year}-12-31`),
    db.select().from(companyClosures).orderBy(companyClosures.startDate),
    listSchoolHolidays(`${year}-01-01`, `${year}-12-31`),
    db
      .select({ id: apprentices.id, name: apprentices.displayName })
      .from(apprentices)
      .where(eq(apprentices.isPlannable, true))
      .orderBy(apprentices.displayName),
  ]);

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Feiertage, Schulferien und Betriebsferien – alles fließt direkt in die Planung ein."
      />
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schulferien {year}</CardTitle>
          <CardDescription>
            In den Ferien findet kein Berufsschulunterricht statt – die Auszubildenden stehen dann
            auch an ihren Schultagen zur Verfügung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolHolidayList
            rows={ferien as SchoolHolidayRow[]}
            coveredUntil={NRW_SCHOOL_HOLIDAYS_UNTIL}
            apprentices={azubis}
          />
        </CardContent>
      </Card>

      <CalendarManager
        holidays={holidays as HolidayRow[]}
        closures={closures as ClosureRow[]}
        year={year}
      />
    </>
  );
}
