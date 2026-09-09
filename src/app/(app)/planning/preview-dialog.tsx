"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateDe, weekdayLabel, isoWeekday } from "@/lib/dates";
import { rankLabel } from "@/lib/labels";
import type { PreviewDay } from "@/app/actions/planning";

/**
 * Zeigt das Ergebnis eines Probelaufs, bevor er geschrieben wird. Wichtig ist
 * nicht die Liste an sich, sondern der Unterschied: Was ergänzt der Lauf, und
 * was stand vorher schon so da.
 */
export function PreviewDialog({
  days,
  issues,
  onClose,
  onApply,
  applyLabel,
  pending,
}: {
  days: PreviewDay[] | null;
  issues: string[];
  onClose: () => void;
  onApply: () => void;
  applyLabel: string;
  pending: boolean;
}) {
  const workdays = (days ?? []).filter(
    (day) => day.isWorkday && day.duties.length > 0,
  );
  const fresh = workdays.reduce(
    (sum, day) =>
      sum +
      day.duties.reduce(
        (n, d) => n + d.entries.filter((e) => !e.kept).length,
        0,
      ),
    0,
  );

  return (
    <Dialog open={days !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vorschau</DialogTitle>
          <DialogDescription>
            {fresh === 0
              ? "Dieser Lauf würde nichts ändern – im Zeitraum ist alles vergeben."
              : `${fresh} Einteilung${fresh === 1 ? "" : "en"} kämen hinzu. Bestehendes ist grau hinterlegt.`}
          </DialogDescription>
        </DialogHeader>

        {workdays.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            Im gewählten Zeitraum liegt kein Arbeitstag, an dem vertreten werden
            muss.
          </p>
        ) : (
          <div className="space-y-3">
            {workdays.map((day) => (
              <div key={day.date} className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">
                  {weekdayLabel(isoWeekday(day.date))} {formatDateDe(day.date)}
                </div>
                <div className="space-y-2">
                  {day.duties.map((duty) => (
                    <div key={duty.key}>
                      <div className="text-muted-foreground text-xs uppercase">
                        {duty.label}
                      </div>
                      {duty.entries.length === 0 ? (
                        <p className="text-destructive text-sm">
                          Niemand verfügbar
                        </p>
                      ) : (
                        <ul className="mt-0.5 flex flex-wrap gap-1.5">
                          {duty.entries.map((entry) => (
                            <li key={`${duty.key}-${entry.rank}`}>
                              <Badge
                                variant={entry.kept ? "outline" : "secondary"}
                                className="gap-1.5 py-1 font-normal"
                              >
                                <span
                                  className={
                                    entry.kept ? "text-muted-foreground" : ""
                                  }
                                >
                                  {entry.name}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                  {rankLabel(entry.rank)}
                                  {entry.kept ? " · bleibt" : ""}
                                </span>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {issues.length > 0 && (
          <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
            <div className="mb-1 text-sm font-medium">
              {issues.length} Hinweis{issues.length === 1 ? "" : "e"}
            </div>
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
              {issues.slice(0, 8).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {issues.length > 8 && <li>… und {issues.length - 8} weitere.</li>}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Schließen
          </Button>
          <Button onClick={onApply} disabled={pending || fresh === 0}>
            {applyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
