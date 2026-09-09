import { db } from "@/db";
import { PageHeader } from "@/components/app/page-header";
import { requirePlanner } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { DeskManager, type StaffRow } from "./desk-manager";
import { DeskFeed } from "@/components/app/desk-feed";

export const metadata = { title: "Zentrale" };

export default async function DeskAdminPage() {
  await requirePlanner();

  const [staff, calendar] = await Promise.all([
    db.query.deskStaff.findMany({
      with: { shifts: true },
      orderBy: (s, { asc }) => [asc(s.name)],
    }),
    getSetting("calendar"),
  ]);

  const rows: StaffRow[] = staff.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    isActive: person.isActive,
    notes: person.notes,
    hasAccount: Boolean(person.userId),
    shifts: person.shifts
      .map((shift) => ({
        id: shift.id,
        weekday: shift.weekday,
        validFrom: shift.validFrom,
        validTo: shift.validTo,
      }))
      .sort((a, b) => a.weekday - b.weekday),
  }));

  return (
    <>
      <PageHeader
        title="Zentrale"
        description="Feste Besetzung der Zentrale und ihre Wochentage."
      />
      <DeskManager staff={rows} />
      <div className="mt-6">
        <DeskFeed token={calendar.deskFeedToken} manageable />
      </div>
    </>
  );
}
