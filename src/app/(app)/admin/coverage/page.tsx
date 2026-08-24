import { asc } from "drizzle-orm";
import { db } from "@/db";
import { coverageSlots } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlanner } from "@/lib/session";
import { SlotManager, type SlotRow } from "./slot-manager";

export const metadata = { title: "Pausenzeiten" };

export default async function SlotsPage() {
  await requirePlanner();

  const slots = await db.select().from(coverageSlots).orderBy(asc(coverageSlots.sortOrder));
  const rows: SlotRow[] = slots.map((slot) => ({
    id: slot.id,
    key: slot.key,
    label: slot.label,
    kind: slot.kind,
    startTime: slot.startTime,
    endTime: slot.endTime,
    weekdays: slot.weekdays,
    weight: Number(slot.weight),
    backupCount: slot.backupCount,
    isActive: slot.isActive,
    sortOrder: slot.sortOrder,
  }));

  return (
    <>
      <PageHeader
        title="Pausenzeiten & Vertretungsarten"
        description="Welche Zeiträume vertreten werden müssen und wie viele Ersatzleute je Termin eingeplant werden."
      />
      <Card>
        <CardContent className="pt-6">
          <SlotManager rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}
