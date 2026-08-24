import { db } from "@/db";
import { companyClosures } from "@/db/schema";
import { listEffectiveHolidays } from "@/lib/calendar";
import { PageHeader } from "@/components/app/page-header";
import { requirePlanner } from "@/lib/session";
import { CalendarManager, type ClosureRow, type HolidayRow } from "./calendar-manager";

export const metadata = { title: "Kalender" };

export default async function CalendarAdminPage(props: PageProps<"/admin/calendar">) {
  await requirePlanner();
  const params = await props.searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [holidays, closures] = await Promise.all([
    listEffectiveHolidays(`${year}-01-01`, `${year}-12-31`),
    db.select().from(companyClosures).orderBy(companyClosures.startDate),
  ]);

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Feiertage in NRW und Betriebsferien – beides fließt direkt in die Planung ein."
      />
      <CalendarManager
        holidays={holidays as HolidayRow[]}
        closures={closures as ClosureRow[]}
        year={year}
      />
    </>
  );
}
