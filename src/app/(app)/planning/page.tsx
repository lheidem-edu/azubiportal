import { PageHeader } from "@/components/app/page-header";
import { PlanBoard } from "@/components/app/plan-board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatDateDe, nextWorkWeeks, today } from "@/lib/dates";
import { getLoadOverview, getPlanBoard } from "@/lib/scheduler/service";
import { getSetting } from "@/lib/settings";
import { requirePlanner } from "@/lib/session";
import { DayEditor } from "./day-editor";
import { FairnessTable } from "./fairness-table";
import { PlanControls } from "./plan-controls";

export const metadata = { title: "Plan erstellen" };

function isIso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function PlanningPage(props: PageProps<"/planning">) {
  await requirePlanner();
  const params = await props.searchParams;
  const general = await getSetting("general");

  /**
   * Standard ist die kommende Arbeitswoche: Die laufende Woche ist verteilt,
   * geplant wird das, was als Nächstes ansteht.
   */
  const defaultRange = nextWorkWeeks(1);
  const rangeStart = isIso(params.from) ? params.from : defaultRange.start;
  const rangeEnd = isIso(params.to) ? params.to : defaultRange.end;
  const selectedDay = isIso(params.day) ? params.day : null;

  const [board, load] = await Promise.all([
    getPlanBoard(rangeStart, rangeEnd),
    getLoadOverview(addDays(today(), -general.fairnessWindowDays), addDays(today(), 365)),
  ]);

  const dayForEditor = selectedDay
    ? ((await getPlanBoard(selectedDay, selectedDay))[0] ?? null)
    : null;

  return (
    <>
      <PageHeader
        title="Plan erstellen"
        description="Die Automatik verteilt die Einsätze gleichmäßig und überspringt Schultage, Urlaub, Feiertage und Betriebsferien."
      />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Planlauf</CardTitle>
          <CardDescription>
            Gesperrte Einteilungen bleiben bei jedem Lauf unverändert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanControls
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            planningWeeks={general.planningWeeks}
          />
        </CardContent>
      </Card>

      {dayForEditor?.isWorkday && (
        <div className="mb-6">
          <DayEditor day={dayForEditor} />
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Verteilung</CardTitle>
          <CardDescription>
            Einsätze der letzten {general.fairnessWindowDays} Tage und des geplanten Zeitraums.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FairnessTable rows={load} />
        </CardContent>
      </Card>

      <h2 className="font-heading mb-3 text-lg font-semibold">
        Plan {formatDateDe(rangeStart)} – {formatDateDe(rangeEnd)}
      </h2>
      <PlanBoard days={board} today={today()} editable />
    </>
  );
}
