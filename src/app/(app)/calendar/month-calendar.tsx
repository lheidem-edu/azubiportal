"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarOff, GraduationCap, Sun, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateLongDe, startOfIsoWeek, weekdayShort, type IsoDate } from "@/lib/dates";
import {
  MARK_LABEL,
  type MarkKind,
  type MonthDay,
  type MonthView,
  type PersonYear,
} from "@/lib/year-marks";

/** Farbe je Abwesenheitsart – feste Werte, damit sie hell wie dunkel tragen. */
/**
 * Hintergrund eines Tages im Raster.
 *
 * Feiertage und Betriebsferien heben sich am stärksten ab – an ihnen wird gar
 * nicht gearbeitet. Schulferien bekommen denselben Farbton, aber blasser: Sie
 * betreffen nur den Berufsschulunterricht, die Auszubildenden sind da.
 * Wochenenden bleiben neutral grau.
 */
function dayBackground(day: { isWeekend: boolean; holiday?: string; closure?: string; schoolHoliday?: string }): string {
  if (day.holiday || day.closure) return "bg-amber-500/25";
  if (day.schoolHoliday) return "bg-amber-500/10";
  if (day.isWeekend) return "bg-muted";
  return "bg-muted/25";
}

const MARK_COLOR: Record<MarkKind, string> = {
  VACATION: "bg-emerald-500",
  SICK: "bg-rose-500",
  SCHOOL: "bg-sky-400",
  TRAINING: "bg-violet-500",
  OTHER: "bg-amber-500",
};

/** Spaltenbreite je Tag. Schmal genug, dass ein ganzer Monat aufs Bild passt. */
const COLUMN = 26;

/**
 * Monatsübersicht als Balkenplan.
 *
 * Abwesenheiten sind Zeiträume, keine Einzeltage – als durchgehender Balken
 * über die betroffenen Tage sieht man auf einen Blick, wie lange jemand weg
 * ist und wo sich Abwesenheiten überschneiden. Eine Zeile je Person, eine
 * Spalte je Tag; die Namensspalte bleibt beim seitlichen Scrollen stehen.
 */
export function MonthCalendar({ view, today }: { view: MonthView; today?: IsoDate }) {
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const day = view.days.find((entry) => entry.date === selected);
  const columns = `repeat(${view.days.length}, ${COLUMN}px)`;

  const toggle = (date: IsoDate) =>
    setSelected((current) => (current === date ? null : date));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-max">
          {/* Tagesleiste */}
          <div className="flex">
            <div className="bg-card sticky left-0 z-20 w-28 shrink-0 sm:w-40" />
            <div className="grid" style={{ gridTemplateColumns: columns }}>
              {view.days.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => toggle(entry.date)}
                  title={formatDateLongDe(entry.date)}
                  className={cn(
                    "flex flex-col items-center rounded-t py-0.5 text-[10px] leading-tight",
                    dayBackground(entry),
                    entry.isWeekend || entry.holiday || entry.closure
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground",
                    entry.date === today &&
                      "border-primary text-primary border-b-2 font-semibold",
                    // Dieselbe Tönung wie in den Zeilen, damit die Auswahl als
                    // durchgehende Spalte lesbar ist.
                    selected === entry.date && "bg-primary/20 text-foreground font-semibold",
                  )}
                >
                  <span>{Number(entry.date.slice(8, 10))}</span>
                  <span className="opacity-70">{weekdayShort(entry.weekday).slice(0, 2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Eine Zeile je Person */}
          {/* Ohne Abstand zwischen den Zeilen, damit die ausgewählte
              Spalte als durchgehendes Band lesbar bleibt. */}
          <div className="mt-1">
            {view.people.map((person) => (
              <PersonRow
                key={`${person.kind}:${person.id}`}
                person={person}
                days={view.days}
                columns={columns}
                today={today}
                selected={selected}
                onSelect={toggle}
              />
            ))}
          </div>
        </div>
      </div>

      <Legend />

      {day && <DayDetails day={day} onClose={() => setSelected(null)} />}
    </div>
  );
}

type Span = {
  kind: MarkKind;
  label: string;
  /** Erste Spalte, 1-basiert wie im Raster. */
  start: number;
  length: number;
  partial: boolean;
  counts: boolean;
  recurring: boolean;
};

/**
 * Fasst aufeinanderfolgende Tage gleicher Art zu einem Balken zusammen.
 * Wochenenden innerhalb eines Urlaubs unterbrechen ihn bewusst nicht – der
 * Zeitraum ist ja durchgehend.
 */
function spansOf(person: PersonYear, days: MonthDay[]): Span[] {
  const spans: Span[] = [];
  let current: Span | null = null;

  days.forEach((day, index) => {
    const mark = person.marks[day.date];
    const key = mark && `${mark.kind}|${mark.label}|${mark.partial}|${mark.recurring}`;

    if (!mark) {
      current = null;
      return;
    }
    if (current && current.length + current.start - 1 === index && key === currentKey(current)) {
      current.length += 1;
      return;
    }
    current = {
      kind: mark.kind,
      label: mark.label,
      start: index + 1,
      length: 1,
      partial: mark.partial,
      counts: mark.counts,
      recurring: mark.recurring,
    };
    spans.push(current);
  });

  return spans;
}

function currentKey(span: Span): string {
  return `${span.kind}|${span.label}|${span.partial}|${span.recurring}`;
}

function PersonRow({
  person,
  days,
  columns,
  today,
  selected,
  onSelect,
}: {
  person: PersonYear;
  days: MonthDay[];
  columns: string;
  today?: IsoDate;
  selected: IsoDate | null;
  onSelect: (date: IsoDate) => void;
}) {
  const spans = spansOf(person, days);

  return (
    <div className="flex items-center">
      <div className="bg-card border-border/40 sticky left-0 z-20 flex h-6 w-28 shrink-0 items-center gap-1 border-r border-b pr-2 text-xs sm:w-40">
        <span className="truncate">{person.name}</span>
        {person.kind === "DESK" && (
          <span className="text-muted-foreground shrink-0 text-[10px]">Z</span>
        )}
      </div>

      <div className="relative grid h-6" style={{ gridTemplateColumns: columns }}>
        {/*
          Jede Zelle bekommt ihre Spalte ausdrücklich zugewiesen. Ohne das
          verdrängen die Balken – die ja feste Spalten belegen – die
          automatisch platzierten Zellen nach rechts, und das Raster läuft aus
          dem Monat heraus.
        */}
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            aria-label={formatDateLongDe(day.date)}
            onClick={() => onSelect(day.date)}
            style={{ gridRow: 1, gridColumn: index + 1 }}
            className={cn(
              "border-border/40 h-6 border-r border-b last:border-r-0",
              dayBackground(day),
              day.date === today && "ring-primary/40 ring-1 ring-inset",
              selected === day.date && "bg-primary/20",
            )}
          />
        ))}

        {/* Balken über den Hintergrund legen */}
        {spans.map((span) => (
          <div
            key={`${span.kind}-${span.start}`}
            style={{ gridRow: 1, gridColumn: `${span.start} / span ${span.length}` }}
            title={`${person.name}: ${span.label}`}
            className={cn(
              "pointer-events-none z-10 my-0.5 flex items-center overflow-hidden rounded px-1",
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

function DayDetails({ day, onClose }: { day: MonthDay; onClose: () => void }) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{formatDateLongDe(day.date)}</div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
            {day.holiday && (
              <span className="flex items-center gap-1">
                <Sun className="size-3" /> {day.holiday}
              </span>
            )}
            {day.closure && (
              <span className="flex items-center gap-1">
                <CalendarOff className="size-3" /> {day.closure}
              </span>
            )}
            {day.schoolHoliday && (
              <span className="flex items-center gap-1">
                <GraduationCap className="size-3" /> {day.schoolHoliday}
              </span>
            )}
            {!day.holiday && !day.closure && day.isWeekend && <span>Wochenende</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
          <X className="size-4" />
        </Button>
      </div>

      {day.entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Niemand abwesend.</p>
      ) : (
        <ul className="space-y-1">
          {day.entries.map(({ person, mark }) => (
            <li
              key={`${person.kind}:${person.id}`}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span
                className={cn("inline-block size-2.5 shrink-0 rounded-sm", MARK_COLOR[mark.kind])}
              />
              <span className="font-medium">{person.name}</span>
              <span className="text-muted-foreground">{mark.label}</span>
              {reasonFor(person, day.date) && (
                <span className="text-muted-foreground text-xs">{reasonFor(person, day.date)}</span>
              )}
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
        <Link href={{ pathname: "/schedule", query: { from: startOfIsoWeek(day.date), weeks: 1 } }}>
          Vertretungsplan dieser Woche
        </Link>
      </Button>
    </div>
  );
}

/** Bemerkung des zugrunde liegenden Eintrags, falls vorhanden. */
function reasonFor(person: PersonYear, date: IsoDate): string | null {
  const entry = person.absences.find((a) => date >= a.startDate && date <= a.endDate);
  return entry?.reason ?? null;
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
        <span className="bg-sky-400 inline-block size-2.5 rounded-sm opacity-35" />
        wöchentlicher Schultag
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-emerald-500 inline-block size-2.5 rounded-sm opacity-55" />
        zählt nicht aufs Konto
      </span>
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
