import { cn } from "@/lib/utils";
import { formatDateDe, weekdayShort } from "@/lib/dates";
import { MARK_LABEL, type MarkKind, type YearOverview } from "@/lib/year-overview";

/** Farbe je Abwesenheitsart. Bewusst feste Farbwerte, damit sie in hellem und dunklem Erscheinungsbild gleich gut lesbar sind. */
const MARK_COLOR: Record<MarkKind, string> = {
  VACATION: "bg-emerald-500",
  SICK: "bg-rose-500",
  SCHOOL: "bg-sky-400",
  TRAINING: "bg-violet-500",
  OTHER: "bg-amber-500",
};

const CELL_WIDTH = 8;
/** Auf dem Telefon schmaler, damit vom Jahr mehr sichtbar bleibt. */
const NAME_COLUMN = "w-28 shrink-0 sm:w-40";

/**
 * Jahreskalender: eine Zeile je Person, eine Spalte je Tag. Die Namensspalte
 * bleibt beim seitlichen Scrollen stehen, damit die Übersicht auch auf dem
 * Telefon benutzbar ist.
 */
export function YearGrid({ overview }: { overview: YearOverview }) {
  const { days, months, people } = overview;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Monatsleiste */}
        <div className="flex">
          <div className={cn("bg-card sticky left-0 z-30", NAME_COLUMN)} />
          {months.map((month) => (
            <div
              key={month.month}
              className="text-muted-foreground border-l pl-1 text-xs first:border-l-0"
              style={{ width: month.days.length * CELL_WIDTH }}
            >
              <span className="hidden sm:inline">{month.label}</span>
              <span className="sm:hidden">{month.label.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Personen */}
        <div className="mt-1 space-y-0.5">
          {people.map((person) => (
            <div key={`${person.kind}:${person.id}`} className="flex items-center">
              {/* Die Namensspalte deckt beim seitlichen Scrollen die Tageszellen ab,
                  deshalb dieselbe Höhe wie eine Zeile und ein deckender Hintergrund. */}
              <div
                className={cn(
                  "bg-card sticky left-0 z-30 flex h-5 items-center gap-1.5 border-r pr-2 text-xs",
                  NAME_COLUMN,
                )}
              >
                <span className="truncate font-medium">{person.name}</span>
                {person.kind === "DESK" && (
                  <span className="text-muted-foreground shrink-0 text-[10px]">Z</span>
                )}
              </div>
              <div className="flex">
                {days.map((day) => {
                  const mark = person.marks[day.date];
                  const blocked = day.isWeekend || Boolean(day.holiday) || Boolean(day.closure);
                  const title = [
                    `${weekdayShort(day.weekday)}, ${formatDateDe(day.date)}`,
                    person.name,
                    mark?.label,
                    day.holiday,
                    day.closure,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <span
                      key={day.date}
                      title={title}
                      style={{ width: CELL_WIDTH }}
                      className={cn(
                        "h-5 border-l first:border-l-0",
                        day.date.endsWith("-01") ? "border-border" : "border-transparent",
                        mark
                          ? MARK_COLOR[mark.kind]
                          : blocked
                            ? "bg-muted"
                            : "bg-muted/30",
                        mark?.recurring && "opacity-35",
                        mark?.partial && "opacity-60",
                        mark?.pending && "opacity-45",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function YearLegend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {(Object.keys(MARK_COLOR) as MarkKind[]).map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-2.5 rounded-sm", MARK_COLOR[kind])} />
          {MARK_LABEL[kind]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="bg-muted inline-block size-2.5 rounded-sm" />
        Wochenende, Feiertag, Betriebsferien
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-emerald-500 inline-block size-2.5 rounded-sm opacity-45" />
        noch nicht genehmigt
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-sky-400 inline-block size-2.5 rounded-sm opacity-35" />
        wöchentlicher Schultag
      </span>
    </div>
  );
}
