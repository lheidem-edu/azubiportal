"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmButton } from "@/components/app/confirm-button";
import { clearRange, generateHorizonAction, generatePlanAction } from "@/app/actions/planning";
import { useAction } from "@/lib/use-action";
import { formatDateDe } from "@/lib/dates";

export function PlanControls({
  rangeStart,
  rangeEnd,
  horizonDays,
}: {
  rangeStart: string;
  rangeEnd: string;
  horizonDays: number;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [start, setStart] = useState(rangeStart);
  const [end, setEnd] = useState(rangeEnd);
  const [issues, setIssues] = useState<string[]>([]);

  function applyRange() {
    router.push(`/planning?from=${start}&to=${end}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="von">Von</Label>
          <Input
            id="von"
            type="date"
            className="w-full sm:w-40"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            onBlur={applyRange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bis">Bis</Label>
          <Input
            id="bis"
            type="date"
            className="w-full sm:w-40"
            min={start}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            onBlur={applyRange}
          />
        </div>

        <Button
          disabled={pending}
          className="w-full sm:w-auto"
          onClick={() =>
            execute(() => generatePlanAction({ rangeStart: start, rangeEnd: end }), {
              onSuccess: (data) => {
                setIssues(data?.issues ?? []);
                router.refresh();
              },
            })
          }
        >
          <Sparkles className="size-4" />
          Plan erzeugen
        </Button>

        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() =>
            execute(() => generateHorizonAction(), {
              onSuccess: (data) => {
                setIssues(data?.issues ?? []);
                router.refresh();
              },
            })
          }
        >
          Komplett bis Tag {horizonDays}
        </Button>

        <ConfirmButton
          variant="ghost"
          size="default"
          className="w-full sm:w-auto"
          disabled={pending}
          title="Zeitraum leeren?"
          description={`Alle nicht gesperrten Einteilungen zwischen ${formatDateDe(start)} und ${formatDateDe(end)} werden gelöscht.`}
          confirmLabel="Leeren"
          onConfirm={() =>
            execute(() => clearRange({ rangeStart: start, rangeEnd: end }), {
              onSuccess: () => {
                setIssues([]);
                router.refresh();
              },
            })
          }
        >
          <Eraser className="size-4" />
          Zeitraum leeren
        </ConfirmButton>
      </div>

      {issues.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{issues.length} Hinweis(e) aus dem letzten Planlauf</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-0.5 pl-4">
              {issues.slice(0, 12).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {issues.length > 12 && <li>… und {issues.length - 12} weitere.</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
