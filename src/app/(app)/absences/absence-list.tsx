"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/app/confirm-button";
import { cancelAbsence } from "@/app/actions/absences";
import { type AbsenceRow } from "@/lib/people";
import { useAction } from "@/lib/use-action";
import { formatRangeDe } from "@/lib/dates";
import { ABSENCE_TYPES } from "./absence-form";

const DAY_PART_LABEL: Record<string, string> = {
  FULL: "",
  MORNING: "vormittags",
  AFTERNOON: "nachmittags",
};

/**
 * Eine Liste für Auszubildende und Zentrale-Besetzung gleichermaßen.
 * Auf dem Telefon steht jeder Eintrag als eigener Block untereinander.
 */
/**
 * Gruppiert die Einträge nach Person. In der Verwaltung stehen sonst alle
 * Zeiträume durcheinander und man sucht sich die einer Person zusammen.
 */
export function AbsenceListByPerson({ rows }: { rows: AbsenceRow[] }) {
  const groups = new Map<string, { name: string; kind: string; entries: AbsenceRow[] }>();
  for (const row of rows) {
    const key = `${row.personKind}:${row.personId}`;
    const group = groups.get(key) ?? { name: row.personName, kind: row.personKind, entries: [] };
    group.entries.push(row);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort(
    (a, b) =>
      Number(a.kind === "DESK") - Number(b.kind === "DESK") || a.name.localeCompare(b.name, "de"),
  );

  if (sorted.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Keine Einträge.</p>;
  }

  return (
    <div className="space-y-4">
      {sorted.map((group) => (
        <div key={group.name}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium">{group.name}</span>
            {group.kind === "DESK" && (
              <Badge variant="secondary" className="h-5">
                Zentrale
              </Badge>
            )}
            <span className="text-muted-foreground text-xs">
              {group.entries.length} {group.entries.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          </div>
          <div className="border-l-2 pl-3">
            <AbsenceList rows={group.entries} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AbsenceList({
  rows,
  showPerson,
}: {
  rows: AbsenceRow[];
  showPerson?: boolean;
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
