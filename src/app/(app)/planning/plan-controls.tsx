"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmButton } from "@/components/app/confirm-button";
import { DatePicker } from "@/components/app/date-picker";
import { clearRange, generateHorizonAction, generatePlanAction } from "@/app/actions/planning";
import { useAction } from "@/lib/use-action";
import { addDays, daysBetween, formatDateDe } from "@/lib/dates";

export function PlanControls({
  rangeStart,
  rangeEnd,
  planningWeeks,
}: {
  rangeStart: string;
  rangeEnd: string;
  planningWeeks: number;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [start, setStart] = useState(rangeStart);
  const [end, setEnd] = useState(rangeEnd);
  const [issues, setIssues] = useState<string[]>([]);

  /**
   * Der Zeitraum steckt in der Adresse, damit er beim Neuladen erhalten bleibt.
   * Die Werte werden übergeben, weil der Zustand im selben Durchlauf noch den
   * alten Stand hätte.
   */
  function applyRange(from: string, to: string) {
    router.push(`/planning?from=${from}&to=${to}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <DatePicker
          id="von"
          label="Von"
          className="sm:w-44"
          value={start}
          onChange={(value) => {
            /*
             * Rutscht der Beginn hinter das Ende, wandert das Ende mit und die
             * Länge des Zeitraums bleibt erhalten – wer eine Woche plant, will
             * beim Vorblättern wieder eine Woche, keinen einzelnen Tag.
             */
            const nextEnd = value > end ? addDays(value, daysBetween(start, end)) : end;
            setStart(value);
            setEnd(nextEnd);
            applyRange(value, nextEnd);
          }}
        />
        <DatePicker
          id="bis"
          label="Bis"
          className="sm:w-44"
          min={start}
          value={end}
          onChange={(value) => {
            setEnd(value);
            applyRange(start, value);
          }}
        />

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
          Nächste {planningWeeks} {planningWeeks === 1 ? "Arbeitswoche" : "Arbeitswochen"}
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
