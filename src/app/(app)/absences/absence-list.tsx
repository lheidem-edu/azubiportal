"use client";

import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-button";
import { cancelAbsence, decideAbsence } from "@/app/actions/absences";
import { type AbsenceRow } from "@/lib/people";
import { useAction } from "@/lib/use-action";
import { formatRangeDe } from "@/lib/dates";
import { ABSENCE_TYPES } from "./absence-form";

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "offen", variant: "outline" },
  APPROVED: { label: "genehmigt", variant: "default" },
  REJECTED: { label: "abgelehnt", variant: "destructive" },
  CANCELLED: { label: "storniert", variant: "secondary" },
};

const DAY_PART_LABEL: Record<string, string> = {
  FULL: "",
  MORNING: "vormittags",
  AFTERNOON: "nachmittags",
};

/**
 * Eine Liste für Auszubildende und Zentrale-Besetzung gleichermaßen.
 * Auf dem Telefon steht jeder Eintrag als eigener Block untereinander.
 */
export function AbsenceList({
  rows,
  showPerson,
  canDecide,
}: {
  rows: AbsenceRow[];
  showPerson?: boolean;
  canDecide?: boolean;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const refresh = () => router.refresh();

  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Keine Einträge.</p>;
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const status = STATUS[row.status] ?? { label: row.status, variant: "outline" as const };
        const typeLabel = ABSENCE_TYPES.find((t) => t.value === row.type)?.label ?? row.type;
        return (
          <li key={row.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              {showPerson && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{row.personName}</span>
                  {row.personKind === "DESK" && (
                    <Badge variant="secondary" className="h-5">
                      Zentrale
                    </Badge>
                  )}
                </div>
              )}
              <div className={showPerson ? "text-muted-foreground text-sm" : "text-sm font-medium"}>
                {formatRangeDe(row.startDate, row.endDate)}
                {DAY_PART_LABEL[row.dayPart] && (
                  <span className="text-muted-foreground"> ({DAY_PART_LABEL[row.dayPart]})</span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {typeLabel}
                {row.reason ? ` · ${row.reason}` : ""}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Badge variant={status.variant}>{status.label}</Badge>
              {canDecide && row.status === "PENDING" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label="Genehmigen"
                    onClick={() =>
                      execute(() => decideAbsence({ id: row.id, status: "APPROVED" }), {
                        onSuccess: refresh,
                      })
                    }
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label="Ablehnen"
                    onClick={() =>
                      execute(() => decideAbsence({ id: row.id, status: "REJECTED" }), {
                        onSuccess: refresh,
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </>
              )}
              <ConfirmButton
                size="icon"
                disabled={pending}
                title="Eintrag löschen?"
                description={`${formatRangeDe(row.startDate, row.endDate)} wird entfernt. Der Plan sollte danach neu erzeugt werden.`}
                confirmLabel="Löschen"
                onConfirm={() => execute(() => cancelAbsence(row.id), { onSuccess: refresh })}
              >
                <Trash2 className="size-4" />
              </ConfirmButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
