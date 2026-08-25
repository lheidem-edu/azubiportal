"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, Sun, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDateDe,
  formatDateLongDe,
  formatRangeDe,
  startOfIsoWeek,
  weekdayLabel,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import {
  MARK_LABEL,
  type MarkKind,
  type PersonYear,
  type YearOverview,
} from "@/lib/year-marks";

/** Farbe je Abwesenheitsart – feste Werte, damit sie hell wie dunkel tragen. */
const MARK_COLOR: Record<MarkKind, string> = {
  VACATION: "bg-emerald-500",
  SICK: "bg-rose-500",
  SCHOOL: "bg-sky-400",
  TRAINING: "bg-violet-500",
  OTHER: "bg-amber-500",
};

const CELL_WIDTH = 8;
const NAME_COLUMN = "w-28 shrink-0 sm:w-40";

/**
 * Jahreskalender: eine Zeile je Person, eine Spalte je Tag.
 *
 * Jede Zelle und jeder Name lässt sich anklicken – darunter erscheinen die
 * Einzelheiten. Ohne das wäre die Darstellung auf dem Telefon kaum zu
 * entschlüsseln, weil dort keine Kurzinfos beim Überfahren erscheinen.
 */
export function YearGrid({ overview, today }: { overview: YearOverview; today?: IsoDate }) {
  const { days, months, people } = overview;
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const dayByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const personByKey = useMemo(
    () => new Map(people.map((person) => [`${person.kind}:${person.id}`, person])),
    [people],
  );

  const day = selectedDate ? dayByDate.get(selectedDate) : undefined;
  const person = selectedPerson ? personByKey.get(selectedPerson) : undefined;

  function selectDay(date: IsoDate) {
    setSelectedPerson(null);
    setSelectedDate((current) => (current === date ? null : date));
  }

  function selectPerson(key: string) {
    setSelectedDate(null);
    setSelectedPerson((current) => (current === key ? null : key));
  }

  return (
    <div className="space-y-4">
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

          <div className="mt-1 space-y-0.5">
            {people.map((entry) => {
              const key = `${entry.kind}:${entry.id}`;
              return (
                <div key={key} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => selectPerson(key)}
                    className={cn(
                      "bg-card hover:text-primary sticky left-0 z-30 flex h-5 items-center gap-1.5 border-r pr-2 text-left text-xs",
                      NAME_COLUMN,
                      selectedPerson === key && "text-primary font-semibold",
                    )}
                  >
                    <span className="truncate font-medium">{entry.name}</span>
                    {entry.kind === "DESK" && (
                      <span className="text-muted-foreground shrink-0 text-[10px]">Z</span>
                    )}
                  </button>

                  <div className="flex">
                    {days.map((gridDay) => {
                      const mark = entry.marks[gridDay.date];
                      const closed =
                        gridDay.isWeekend || Boolean(gridDay.holiday) || Boolean(gridDay.closure);
                      return (
                        <button
                          key={gridDay.date}
                          type="button"
                          onClick={() => selectDay(gridDay.date)}
                          title={`${weekdayShort(gridDay.weekday)}, ${formatDateDe(gridDay.date)}${
                            mark ? ` · ${entry.name}: ${mark.label}` : ""
                          }`}
                          aria-label={`${formatDateDe(gridDay.date)}, ${entry.name}${
                            mark ? `, ${mark.label}` : ""
                          }`}
                          style={{ width: CELL_WIDTH }}
                          className={cn(
                            "h-5 border-l first:border-l-0",
                            gridDay.date.endsWith("-01") ? "border-border" : "border-transparent",
                            mark ? MARK_COLOR[mark.kind] : closed ? "bg-muted" : "bg-muted/30",
                            mark?.recurring && "opacity-35",
                            mark?.partial && "opacity-60",
                            mark && !mark.counts && !mark.recurring && "opacity-40",
                            gridDay.date === today && "ring-primary/70 relative z-10 ring-1",
                            selectedDate === gridDay.date && "ring-foreground relative z-10 ring-2",
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <YearLegend />

      {day && (
        <DayDetails
          date={day.date}
          weekday={day.weekday}
          holiday={day.holiday}
          closure={day.closure}
          people={people}
          onClose={() => setSelectedDate(null)}
        />
      )}
      {person && <PersonDetails person={person} onClose={() => setSelectedPerson(null)} />}
      {!day && !person && (
        <p className="text-muted-foreground text-xs">
          Auf einen Tag oder einen Namen tippen, um die Einzelheiten zu sehen.
        </p>
      )}
    </div>
  );
}

function DetailCard({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {subtitle && <div className="text-muted-foreground text-xs">{subtitle}</div>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
          <X className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function DayDetails({
  date,
  weekday,
  holiday,
  closure,
  people,
  onClose,
}: {
  date: IsoDate;
  weekday: number;
  holiday?: string;
  closure?: string;
  people: PersonYear[];
  onClose: () => void;
}) {
  const absent = people
    .map((person) => ({ person, mark: person.marks[date] }))
    .filter((entry) => entry.mark);

  return (
    <DetailCard
      title={formatDateLongDe(date)}
      subtitle={
        holiday ? (
          <span className="flex items-center gap-1">
            <Sun className="size-3" /> {holiday}
          </span>
        ) : closure ? (
          <span className="flex items-center gap-1">
            <CalendarOff className="size-3" /> {closure}
          </span>
        ) : weekday >= 6 ? (
          "Wochenende"
        ) : undefined
      }
      onClose={onClose}
    >
      {absent.length === 0 ? (
        <p className="text-muted-foreground text-sm">Niemand abwesend.</p>
      ) : (
        <ul className="space-y-1">
          {absent.map(({ person, mark }) => (
            <li key={`${person.kind}:${person.id}`} className="flex items-center gap-2 text-sm">
              <span
                className={cn("inline-block size-2.5 shrink-0 rounded-sm", MARK_COLOR[mark.kind])}
              />
              <span className="font-medium">{person.name}</span>
              <span className="text-muted-foreground">{mark.label}</span>
              {person.kind === "DESK" && !mark.counts && (
                <Badge variant="outline" className="h-5">
                  kein Zentrale-Tag
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-2" asChild>
        <Link href={{ pathname: "/schedule", query: { from: startOfIsoWeek(date), weeks: 1 } }}>
          Vertretungsplan dieser Woche
        </Link>
      </Button>
    </DetailCard>
  );
}

function PersonDetails({ person, onClose }: { person: PersonYear; onClose: () => void }) {
  return (
    <DetailCard
      title={person.name}
      subtitle={
        person.kind === "DESK"
          ? person.deskWeekdays.length > 0
            ? `Zentrale: ${person.deskWeekdays.map(weekdayLabel).join(", ")}`
            : "Zentrale – noch kein Wochentag zugeordnet"
          : "Auszubildende:r"
      }
      onClose={onClose}
    >
      {person.absences.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine Einträge in diesem Jahr.</p>
      ) : (
        <ul className="divide-y">
          {person.absences.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-2 py-1.5 text-sm">
              <span
                className={cn("inline-block size-2.5 shrink-0 rounded-sm", MARK_COLOR[entry.kind])}
              />
              <span className="font-medium">{formatRangeDe(entry.startDate, entry.endDate)}</span>
              <span className="text-muted-foreground">{entry.label}</span>
              {entry.reason && <span className="text-muted-foreground text-xs">{entry.reason}</span>}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {entry.countedDays.toLocaleString("de-DE")}{" "}
                {entry.countedDays === 1 ? "Tag" : "Tage"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}

function YearLegend() {
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
        <span className="bg-sky-400 inline-block size-2.5 rounded-sm opacity-35" />
        wöchentlicher Schultag
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-emerald-500 inline-block size-2.5 rounded-sm opacity-40" />
        zählt nicht aufs Konto
      </span>
    </div>
  );
}
