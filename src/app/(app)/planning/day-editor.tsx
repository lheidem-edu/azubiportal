"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/app/confirm-button";
import {
  availableForDuty,
  deleteAssignment,
  reassignAction,
  setAssignmentLock,
} from "@/app/actions/planning";
import { useAction } from "@/lib/use-action";
import { formatDateLongDe, formatTime } from "@/lib/dates";
import { enumerateDe, rankLabel } from "@/lib/labels";
import { UNAVAILABILITY_LABEL } from "@/lib/scheduler/availability";
import type { BoardDay } from "@/lib/scheduler/service";

/**
 * Tagesansicht zum manuellen Eingreifen. Ein Tausch gilt immer für den
 * kompletten Dienst: Umfasst er mehrere Zeitfenster, übernimmt dieselbe Person
 * alle. Getauschte Einteilungen werden gesperrt, damit der nächste Planlauf
 * sie nicht überschreibt.
 */
export function DayEditor({ day }: { day: BoardDay }) {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{formatDateLongDe(day.date)}</CardTitle>
        <CardDescription>
          {day.requiresFullDay
            ? `Ausfall: ${day.absentStaff.join(", ") || "Festbesetzung"}`
            : enumerateDe(day.duties.map((duty) => duty.label))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {day.duties.map((duty) => (
          <div key={duty.key} className="space-y-3">
            <div>
              <span className="text-sm font-medium">{duty.label}</span>
              <div className="text-muted-foreground text-xs">
                {duty.times
                  .map((time) => {
                    const span = `${formatTime(time.startTime)}–${formatTime(time.endTime)}`;
                    // Bei zusammengefassten Pausen sagt der Name des Zeitfensters,
                    // um welche Pause es geht; bei einem einzelnen wäre er doppelt.
                    return duty.times.length > 1 ? `${time.label}: ${span}` : span;
                  })
                  .join(" · ")}{" "}
                Uhr
              </div>
            </div>

            {duty.entries.map((entry) => (
              <div
                key={entry.rank}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:border-0 sm:p-0"
              >
                <Badge
                  variant={entry.rank === 1 ? "default" : "secondary"}
                  className="w-24 justify-center"
                >
                  {rankLabel(entry.rank)}
                </Badge>
                <ApprenticePicker
                  date={day.date}
                  slotIds={duty.slotIds}
                  value={entry.apprenticeId}
                  disabled={pending}
                  onChange={(apprenticeId) =>
                    execute(
                      () =>
                        reassignAction({
                          assignmentIds: entry.assignmentIds,
                          apprenticeId,
                          lock: true,
                        }),
                      { onSuccess: () => router.refresh() },
                    )
                  }
                />
                <div className="ml-auto flex items-center gap-1 sm:ml-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={entry.isLocked ? "Sperre aufheben" : "Einteilung sperren"}
                    title={
                      entry.isLocked
                        ? "Gesperrt – bleibt beim nächsten Planlauf erhalten"
                        : "Sperren, damit der nächste Planlauf sie nicht ändert"
                    }
                    onClick={() =>
                      execute(() => setAssignmentLock(entry.assignmentIds, !entry.isLocked), {
                        onSuccess: () => router.refresh(),
                      })
                    }
                  >
                    {entry.isLocked ? (
                      <Lock className="size-4" />
                    ) : (
                      <LockOpen className="text-muted-foreground size-4" />
                    )}
                  </Button>
                  <ConfirmButton
                    size="icon"
                    disabled={pending}
                    title="Einteilung entfernen?"
                    description="Der Platz bleibt danach unbesetzt, bis neu geplant wird."
                    confirmLabel="Entfernen"
                    onConfirm={() =>
                      execute(() => deleteAssignment(entry.assignmentIds), {
                        onSuccess: () => router.refresh(),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              </div>
            ))}

            {duty.missingRanks.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Unbesetzt: {duty.missingRanks.map((rank) => rankLabel(rank)).join(", ")} – über
                „Plan erzeugen&ldquo; wird automatisch nachbesetzt.
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApprenticePicker({
  date,
  slotIds,
  value,
  disabled,
  onChange,
}: {
  date: string;
  slotIds: string[];
  value: string;
  disabled?: boolean;
  onChange: (apprenticeId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["available", date, slotIds.join(",")],
    queryFn: () => availableForDuty(date, slotIds),
  });

  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder={isLoading ? "Lade …" : "Auswählen"} />
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((option) => (
          <SelectItem
            key={option.id}
            value={option.id}
            disabled={!option.available || (option.alreadyAssigned && option.id !== value)}
          >
            {option.name}
            {!option.available && option.reason
              ? ` – ${UNAVAILABILITY_LABEL[option.reason]}`
              : option.alreadyAssigned && option.id !== value
                ? " – bereits eingeteilt"
                : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
