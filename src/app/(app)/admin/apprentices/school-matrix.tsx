"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableScroll } from "@/components/app/table-scroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteSchoolTerm } from "@/app/actions/school";
import { useAction } from "@/lib/use-action";
import { formatDateDe, today, weekdayLabel, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type SchoolTermEntry = {
  id: string;
  apprenticeId: string;
  apprenticeName: string;
  weekday: number;
  validFrom: string;
  validTo: string | null;
  intervalWeeks: number;
};

const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Schultage als Wochentags-Matrix: eine Zeile je Person, eine Spalte je
 * Wochentag. Damit ist auf einen Blick zu sehen, wer wann in der Schule ist –
 * eine fortlaufende Liste beantwortet genau diese Frage nur mühsam.
 */
export function SchoolMatrix({
  people,
  terms,
}: {
  people: { id: string; name: string }[];
  terms: SchoolTermEntry[];
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const now = today();

  if (people.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Noch keine Auszubildenden angelegt.
      </p>
    );
  }

  return (
    <TableScroll>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Auszubildende:r</TableHead>
            {WEEKDAYS.map((weekday) => (
              <TableHead key={weekday} className="text-center">
                <span className="hidden sm:inline">{weekdayLabel(weekday)}</span>
                <span className="sm:hidden">{weekdayShort(weekday)}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => {
            const own = terms.filter((term) => term.apprenticeId === person.id);
            return (
              <TableRow key={person.id}>
                <TableCell className="font-medium">
                  {person.name}
                  {own.length === 0 && (
                    <span className="text-muted-foreground ml-2 text-xs">kein Schultag</span>
                  )}
                </TableCell>
                {WEEKDAYS.map((weekday) => {
                  const entries = own.filter((term) => term.weekday === weekday);
                  return (
                    <TableCell key={weekday} className="text-center align-top">
                      {entries.map((term) => {
                        const expired = term.validTo && term.validTo < now;
                        return (
                          <div
                            key={term.id}
                            className={cn(
                              "flex flex-col items-center gap-0.5",
                              expired && "opacity-50",
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <Badge variant={term.intervalWeeks > 1 ? "secondary" : "default"}>
                                {term.intervalWeeks > 1 ? `alle ${term.intervalWeeks} Wo.` : "Schule"}
                              </Badge>
                              <ConfirmButton
                                size="icon"
                                disabled={pending}
                                title="Schultag entfernen?"
                                description={`${person.name}, ${weekdayLabel(weekday)}. Bereits erzeugte Pläne bleiben unverändert – bitte danach neu planen.`}
                                confirmLabel="Entfernen"
                                onConfirm={() =>
                                  execute(() => deleteSchoolTerm(term.id), {
                                    onSuccess: () => router.refresh(),
                                  })
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </ConfirmButton>
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                              ab {formatDateDe(term.validFrom)}
                              {term.validTo ? ` bis ${formatDateDe(term.validTo)}` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableScroll>
  );
}
