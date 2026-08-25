"use client";

import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteSchoolHoliday, importSchoolHolidays } from "@/app/actions/calendar";
import { useAction } from "@/lib/use-action";
import { formatRangeDe, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type SchoolHolidayRow = {
  id: string;
  name: string;
  schoolYear: string | null;
  startDate: string;
  endDate: string;
  source: string;
};

/**
 * Schulferien in NRW. Sie lassen sich nicht berechnen, sondern stammen aus der
 * Ferienordnung des Schulministeriums; die Termine sind mitgeliefert und
 * lassen sich hier ergänzen oder entfernen.
 */
export function SchoolHolidayList({
  rows,
  coveredUntil,
}: {
  rows: SchoolHolidayRow[];
  coveredUntil: string;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const now = today();

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Für dieses Jahr sind keine Ferien hinterlegt.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const past = row.endDate < now;
            return (
              <li
                key={row.id}
                className={cn("flex items-center justify-between gap-3 py-2", past && "opacity-60")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.name}</span>
                    {row.schoolYear && (
                      <Badge variant="outline" className="h-5">
                        {row.schoolYear}
                      </Badge>
                    )}
                    {row.source === "MANUAL" && (
                      <Badge variant="secondary" className="h-5">
                        eigener Eintrag
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatRangeDe(row.startDate, row.endDate)}
                  </div>
                </div>
                <ConfirmButton
                  size="icon"
                  disabled={pending}
                  title="Ferien entfernen?"
                  description="In diesem Zeitraum gelten die Berufsschultage danach wieder."
                  confirmLabel="Entfernen"
                  onConfirm={() =>
                    execute(() => deleteSchoolHoliday(row.id), { onSuccess: () => router.refresh() })
                  }
                >
                  <Trash2 className="size-4" />
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            execute(() => importSchoolHolidays(), { onSuccess: () => router.refresh() })
          }
        >
          <Download className="size-4" />
          Ferienordnung einlesen
        </Button>
        <span className="text-muted-foreground text-xs">
          Mitgelieferte Termine reichen bis {formatRangeDe(coveredUntil, coveredUntil)}.
        </span>
      </div>
    </div>
  );
}
