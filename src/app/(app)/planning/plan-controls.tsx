"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Eye, Shuffle, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmButton } from "@/components/app/confirm-button";
import { DatePicker } from "@/components/app/date-picker";
import {
  clearRange,
  generateHorizonAction,
  generatePlanAction,
  previewPlanAction,
  type PlanMode,
  type PreviewDay,
} from "@/app/actions/planning";
import { useAction } from "@/lib/use-action";
import { addDays, daysBetween, formatDateDe } from "@/lib/dates";
import { PreviewDialog } from "./preview-dialog";

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
  const [preview, setPreview] = useState<{
    days: PreviewDay[];
    issues: string[];
    mode: PlanMode;
  } | null>(null);

  function generate(mode: PlanMode) {
    execute(() => generatePlanAction({ rangeStart: start, rangeEnd: end, mode }), {
      onSuccess: (data) => {
        setIssues(data?.issues ?? []);
        setPreview(null);
        router.refresh();
      },
    });
  }

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
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() =>
            execute(() => previewPlanAction({ rangeStart: start, rangeEnd: end, mode: "fill" }), {
              onSuccess: (data) =>
                setPreview({ days: data?.days ?? [], issues: data?.issues ?? [], mode: "fill" }),
            })
          }
        >
          <Eye className="size-4" />
          Vorschau
        </Button>

        <Button disabled={pending} className="w-full sm:w-auto" onClick={() => generate("fill")}>
          <Sparkles className="size-4" />
          Offene Tage planen
        </Button>

        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() =>
            execute(() => generateHorizonAction({ mode: "fill" }), {
              onSuccess: (data) => {
                setIssues(data?.issues ?? []);
                router.refresh();
              },
            })
          }
        >
          Nächste {planningWeeks} {planningWeeks === 1 ? "Arbeitswoche" : "Arbeitswochen"}
        </Button>

        {/*
          Die beiden Handgriffe, die Vergebenes anfassen, stehen abgesetzt am
          Ende – sie ändern Termine, die jemand vielleicht schon kennt.
        */}
        <div className="sm:border-border/60 grid gap-2 sm:ml-auto sm:flex sm:border-l sm:pl-3">
          <ConfirmButton
            variant="ghost"
            size="default"
            className="w-full sm:w-auto"
            disabled={pending}
            title="Zeitraum neu verteilen?"
            description={`Alle nicht gesperrten Einteilungen zwischen ${formatDateDe(start)} und ${formatDateDe(end)} werden verworfen und neu ausgelost. Bereits mitgeteilte Termine können sich dadurch ändern.`}
            confirmLabel="Neu verteilen"
            onConfirm={() => generate("redistribute")}
          >
            <Shuffle className="size-4" />
            Neu verteilen
          </ConfirmButton>

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
      </div>

      <PreviewDialog
        days={preview?.days ?? null}
        issues={preview?.issues ?? []}
        pending={pending}
        applyLabel="So übernehmen"
        onClose={() => setPreview(null)}
        onApply={() => generate(preview?.mode ?? "fill")}
      />

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
