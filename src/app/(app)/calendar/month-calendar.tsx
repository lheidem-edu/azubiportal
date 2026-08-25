"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarOff, GraduationCap, Sun, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDateLongDe,
  startOfIsoWeek,
  weekdayLabel,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import {
  MARK_LABEL,
  type MarkKind,
  type MonthDay,
  type MonthView,
  type PersonYear,
} from "@/lib/year-marks";

/** Farbe je Abwesenheitsart – feste Werte, damit sie hell wie dunkel tragen. */
const MARK_COLOR: Record<MarkKind, string> = {
  VACATION: "bg-emerald-500",
  SICK: "bg-rose-500",
  SCHOOL: "bg-sky-400",
  TRAINING: "bg-violet-500",
  OTHER: "bg-amber-500",
};

const WEEKDAY_HEADERS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Monatskalender der Abwesenheiten.
 *
 * Auf dem Bildschirm ein Gitter wie im Wandkalender, auf dem Telefon
 * dieselben Tage untereinander – dort wären sieben Spalten unlesbar.
 * Jeder Tag nennt die betroffenen Personen namentlich; ein Tippen öffnet
 * die Einzelheiten mit Grund und angerechneten Tagen.
 */
export function MonthCalendar({ view, today }: { view: MonthView; today?: IsoDate }) {
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const day = view.days.find((entry) => entry.date === selected);

  return (
    <div className="space-y-4">
      {/* Wochentagsleiste, nur im Gitter sinnvoll */}
      <div className="hidden grid-cols-7 gap-2 sm:grid">
        {WEEKDAY_HEADERS.map((weekday) => (
          <div key={weekday} className="text-muted-foreground text-center text-xs font-medium">
            {weekdayShort(weekday)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {Array.from({ length: view.leadingBlanks }).map((_, index) => (
          <div key={`blank-${index}`} className="hidden sm:block" />
        ))}

        {view.days.map((entry) => (
          <DayCell
            key={entry.date}
            day={entry}
            isToday={entry.date === today}
            isSelected={selected === entry.date}
            onSelect={() => setSelected((current) => (current === entry.date ? null : entry.date))}
          />
        ))}
      </div>

      <Legend />

      {day && <DayDetails day={day} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DayCell({
  day,
  isToday,
  isSelected,
  onSelect,
}: {
  day: MonthDay;
  isToday?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
}) {
  const closed = day.isWeekend || Boolean(day.holiday) || Boolean(day.closure);
  const note = day.holiday ?? day.closure;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "bg-card flex min-h-24 flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
        // Auf dem Telefon stehen Wochenenden ohne Einträge nur im Weg
        day.isWeekend && day.entries.length === 0 && "hidden sm:flex",
        closed && "bg-muted/50",
        isToday && "ring-primary/60 ring-2",
        isSelected && "ring-foreground ring-2",
        "hover:border-foreground/30",
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={cn("text-sm font-medium", closed && "text-muted-foreground")}>
          {Number(day.date.slice(8, 10))}.
          <span className="text-muted-foreground ml-1 text-xs sm:hidden">
            {weekdayLabel(day.weekday)}
          </span>
        </span>
        {day.schoolHoliday && (
          <GraduationCap
            className="text-muted-foreground size-3.5 shrink-0"
            aria-label={day.schoolHoliday}
          />
        )}
      </div>

      {note && <div className="text-muted-foreground truncate text-[11px]">{note}</div>}

      <ul className="space-y-0.5">
        {day.entries.map(({ person, mark }) => (
          <li
            key={`${person.kind}:${person.id}`}
            className={cn(
              "flex items-center gap-1 text-[11px]",
              mark.recurring && "text-muted-foreground",
              !mark.counts && !mark.recurring && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                MARK_COLOR[mark.kind],
                (mark.recurring || !mark.counts) && "opacity-50",
              )}
            />
            <span className="truncate">{person.shortName}</span>
          </li>
        ))}
      </ul>
    </button>
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
            <li key={`${person.kind}:${person.id}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={cn("inline-block size-2.5 shrink-0 rounded-sm", MARK_COLOR[mark.kind])} />
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
        <GraduationCap className="size-3" />
        Schulferien
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-emerald-500 inline-block size-2.5 rounded-sm opacity-50" />
        zählt nicht aufs Konto
      </span>
    </div>
  );
}
