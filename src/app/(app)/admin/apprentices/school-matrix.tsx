"use client";

import { useRouter } from "next/navigation";
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
import { deleteSchoolTerm, endSchoolTerm } from "@/app/actions/school";
import { EndOrDeleteDialog } from "@/components/app/end-or-delete-dialog";
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
                            <EndOrDeleteDialog
                              trigger={
                                <button aria-label="Schultag bearbeiten">
                                  <Badge
                                    variant={term.intervalWeeks > 1 ? "secondary" : "default"}
                                    className="hover:bg-accent cursor-pointer"
                                  >
                                    {term.intervalWeeks > 1
                                      ? `alle ${term.intervalWeeks} Wo.`
                                      : "Schule"}
                                  </Badge>
                                </button>
                              }
                              title={`Schultag ${weekdayLabel(weekday)} – ${person.name}`}
                              description={`Eingetragen ab ${formatDateDe(term.validFrom)}. Endet der Berufsschulblock, setze einen Stichtag – die bisherigen Pläne behalten damit ihre Begründung.`}
                              minDate={term.validFrom}
                              deleteWarning="Der Schultag verschwindet vollständig. Vergangene Pläne sehen danach so aus, als wäre die Person an diesem Wochentag nie in der Schule gewesen."
                              pending={pending}
                              onEnd={(validTo) =>
                                execute(() => endSchoolTerm(term.id, validTo), {
                                  onSuccess: () => router.refresh(),
                                })
                              }
                              onDelete={() =>
                                execute(() => deleteSchoolTerm(term.id), {
                                  onSuccess: () => router.refresh(),
                                })
                              }
                            />
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
