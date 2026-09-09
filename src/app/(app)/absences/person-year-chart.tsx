import { cn } from "@/lib/utils";
import { formatDateLongDe, isoWeekday, weekdayShort, type IsoDate } from "@/lib/dates";
import { MARK_LABEL, MONTH_NAMES, type MarkKind, type PersonYear, type YearOverview } from "@/lib/year-marks";
import { dayBackground, MARK_COLOR } from "@/components/app/calendar-colors";

/** Spaltenbreite je Tag. Schmal genug, dass 31 Tage nebeneinander passen. */
const COLUMN = 22;

/**
 * Eigener Jahresüberblick als Balkenplan: eine Zeile je Monat, eine Spalte je
 * Tag im Monat.
 *
 * Die Spalten sind Tagesnummern, nicht Wochentage – dadurch stehen die zwölf
 * Monate bündig untereinander und zusammenhängende Abwesenheiten werden zu
 * einem durchgehenden Balken, statt über Wochengrenzen zu zerfallen.
 */
export function PersonYearChart({
  overview,
  person,
  today,
}: {
  overview: YearOverview;
  person: PersonYear;
  today?: IsoDate;
}) {
  const columns = `repeat(31, ${COLUMN}px)`;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-max">
          {/* Tagesnummern */}
          <div className="flex">
            <div className="bg-card sticky left-0 z-20 w-16 shrink-0 sm:w-20" />
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              {Array.from({ length: 31 }, (_, index) => (
                <div
                  key={index}
                  className="text-muted-foreground text-center text-[10px] leading-4"
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>

          {overview.months.map((month) => (
            <MonthRow
              key={month.month}
              label={MONTH_NAMES[month.month - 1]}
              days={month.days}
              person={person}
              columns={columns}
              today={today}
            />
          ))}
        </div>
      </div>

      <Legend />
    </div>
  );
}

function MonthRow({
  label,
  days,
  person,
  columns,
  today,
}: {
  label: string;
  days: YearOverview["days"];
  person: PersonYear;
  columns: string;
  today?: IsoDate;
}) {
  const spans = buildSpans(days, person);

  return (
    <div className="flex items-center">
      <div className="bg-card border-border/40 sticky left-0 z-20 flex h-6 w-16 shrink-0 items-center border-r border-b pr-2 text-xs sm:w-20">
        <span className="truncate">
          <span className="sm:hidden">{label.slice(0, 3)}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      </div>

      <div className="relative grid h-6" style={{ gridTemplateColumns: columns }}>
        {/*
          Jede Zelle bekommt ihre Spalte ausdrücklich zugewiesen – die Balken
          belegen feste Spalten und würden die automatisch platzierten Zellen
          sonst nach rechts schieben.
        */}
        {Array.from({ length: 31 }, (_, index) => {
          const day = days[index];
          if (!day) {
            // Kürzere Monate: der Rest der Zeile bleibt leer.
            return (
              <div
                key={`leer-${index}`}
                style={{ gridRow: 1, gridColumn: index + 1 }}
                className="h-6"
              />
            );
          }
          return (
            <div
              key={day.date}
              title={dayTitle(day.date, day.holiday ?? day.closure ?? day.schoolHoliday)}
              style={{ gridRow: 1, gridColumn: index + 1 }}
              className={cn(
                "border-border/40 h-6 border-r border-b",
                dayBackground(day),
                day.date === today && "ring-primary/40 ring-1 ring-inset",
              )}
            />
          );
        })}

        {spans.map((span) => (
          <div
            key={`${span.kind}-${span.start}`}
            style={{ gridRow: 1, gridColumn: `${span.start} / span ${span.length}` }}
            title={span.title}
            className={cn(
              "z-10 m-0.5 flex items-center justify-center rounded-sm px-1",
              MARK_COLOR[span.kind],
              span.recurring && "opacity-35",
              span.partial && "opacity-60",
              !span.counts && !span.recurring && "opacity-55",
            )}
          >
            {span.length >= 3 && (
              <span className="truncate text-[10px] font-medium text-white">{span.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type Span = {
  kind: MarkKind;
  /** Spalte im Raster, beginnend bei 1. */
  start: number;
  length: number;
  label: string;
  title: string;
  partial: boolean;
  recurring: boolean;
  counts: boolean;
};

/**
 * Fasst aufeinanderfolgende Tage gleicher Art zu einem Balken zusammen.
 * Unterbrechungen und Wechsel der Art beenden den Balken.
 */
function buildSpans(days: YearOverview["days"], person: PersonYear): Span[] {
  const spans: Span[] = [];

  for (let index = 0; index < days.length; index++) {
    const mark = person.marks[days[index].date];
    if (!mark) continue;

    // Vom ersten markierten Tag aus laufen, solange sich nichts ändert.
    let length = 1;
    while (index + length < days.length) {
      const next = person.marks[days[index + length].date];
      if (
        !next ||
        next.kind !== mark.kind ||
        next.partial !== mark.partial ||
        next.recurring !== mark.recurring ||
        next.counts !== mark.counts
      ) {
        break;
      }
      length++;
    }

    spans.push({
      kind: mark.kind,
      start: index + 1,
      length,
      label: MARK_LABEL[mark.kind],
      title: `${person.name}: ${MARK_LABEL[mark.kind]}${mark.recurring ? " (wöchentlich)" : ""}${
        mark.counts ? "" : " – zählt nicht aufs Konto"
      }`,
      partial: mark.partial,
      recurring: mark.recurring,
      counts: mark.counts,
    });

    index += length - 1;
  }

  return spans;
}

function dayTitle(date: IsoDate, note?: string): string {
  const base = `${weekdayShort(isoWeekday(date))}, ${formatDateLongDe(date)}`;
  return note ? `${base} · ${note}` : base;
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {(Object.keys(MARK_COLOR) as MarkKind[]).map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-2.5 rounded-sm", MARK_COLOR[kind])} />
          {MARK_LABEL[kind]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-sm bg-amber-500/25" />
        Feiertag, Betriebsferien
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-sm bg-amber-500/10" />
        Schulferien
      </span>
    </div>
  );
}
