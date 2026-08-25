import Link from "next/link";
import { CalendarOff, Lock, Sun, TriangleAlert, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDateDe,
  formatTime,
  isoWeekNumber,
  startOfIsoWeek,
  weekdayLabel,
  type IsoDate,
} from "@/lib/dates";
import type { BoardDay, BoardDuty } from "@/lib/scheduler/service";
import { rankLabel, SLOT_KIND_LABEL } from "@/lib/labels";

/**
 * Wochenweise Plantafel. Jede Karte ist ein Tag mit seinen Diensten:
 * die Vertretung (fett) und darunter die Ersatzleute.
 */
export function PlanBoard({
  days,
  highlightApprenticeId,
  today,
  editable,
}: {
  days: BoardDay[];
  highlightApprenticeId?: string | null;
  today?: IsoDate;
  editable?: boolean;
}) {
  const weeks = groupByWeek(days);

  return (
    <div className="space-y-6 sm:space-y-8">
      {weeks.map((week) => (
        <section key={week.start}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-heading text-sm font-semibold">KW {isoWeekNumber(week.start)}</h2>
            <span className="text-muted-foreground text-xs">
              {formatDateDe(week.days[0].date)} – {formatDateDe(week.days.at(-1)!.date)}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {week.days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                isToday={day.date === today}
                highlightApprenticeId={highlightApprenticeId}
                editable={editable}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DayCard({
  day,
  isToday,
  highlightApprenticeId,
  editable,
}: {
  day: BoardDay;
  isToday?: boolean;
  highlightApprenticeId?: string | null;
  editable?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col rounded-lg border",
        isToday && "ring-primary/60 ring-2",
        !day.isWorkday && "bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="leading-tight">
          <div className="text-sm font-medium">{weekdayLabel(day.weekday)}</div>
          <div className="text-muted-foreground text-xs">{formatDateDe(day.date)}</div>
        </div>
        {day.requiresFullDay && day.isWorkday && (
          <Badge variant="destructive" className="gap-1">
            <UserRoundX className="size-3" />
            {SLOT_KIND_LABEL.FULL_DAY}
          </Badge>
        )}
      </div>

      {!day.isWorkday ? (
        <div className="text-muted-foreground flex flex-1 items-center gap-2 px-3 py-4 text-xs">
          {day.holidayName ? <Sun className="size-3.5" /> : <CalendarOff className="size-3.5" />}
          <span>{day.holidayName ?? day.closureName ?? day.skipReason}</span>
        </div>
      ) : (
        <div className="flex-1 space-y-3 p-3">
          {day.absentStaff.length > 0 && (
            <p className="text-muted-foreground text-xs">Ausfall: {day.absentStaff.join(", ")}</p>
          )}
          {day.duties.map((duty) => (
            <DutyBlock
              key={duty.key}
              duty={duty}
              highlightApprenticeId={highlightApprenticeId}
            />
          ))}
        </div>
      )}

      {editable && day.isWorkday && (
        <div className="border-t px-3 py-1.5">
          <Link
            href={{ pathname: "/planning", query: { day: day.date } }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Tag bearbeiten
          </Link>
        </div>
      )}
    </div>
  );
}

function DutyBlock({
  duty,
  highlightApprenticeId,
}: {
  duty: BoardDuty;
  highlightApprenticeId?: string | null;
}) {
  return (
    <div>
      <div className="mb-1">
        <span className="text-xs font-medium">{duty.label}</span>
        <div className="text-muted-foreground text-[11px]">
          {duty.times
            .map((time) => `${formatTime(time.startTime)}–${formatTime(time.endTime)}`)
            .join(" · ")}
        </div>
        {duty.derivedFrom && (
          <div className="text-muted-foreground text-[11px] italic">
            übernimmt {rankLabel(duty.derivedFrom.rank)}
          </div>
        )}
      </div>

      {duty.entries.length === 0 ? (
        <div className="text-destructive flex items-center gap-1.5 text-xs">
          <TriangleAlert className="size-3.5" />
          Noch nicht geplant
        </div>
      ) : (
        <ul className="space-y-0.5">
          {duty.entries.map((entry) => (
            <li
              key={entry.rank}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                entry.rank === 1 ? "font-medium" : "text-muted-foreground",
                highlightApprenticeId === entry.apprenticeId && "text-primary font-semibold",
              )}
            >
              <span
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  entry.rank === 1 ? "bg-primary" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span className="truncate">{entry.apprenticeName}</span>
              {entry.rank > 1 && (
                <span className="text-[10px] whitespace-nowrap">({rankLabel(entry.rank)})</span>
              )}
              {duty.derivedFrom && entry.rank === 1 && (
                <span className="text-[10px] whitespace-nowrap">
                  ({rankLabel(duty.derivedFrom.rank)})
                </span>
              )}
              {entry.isLocked && (
                <Lock className="text-muted-foreground size-3 shrink-0" aria-label="gesperrt" />
              )}
            </li>
          ))}
        </ul>
      )}

      {duty.entries.length > 0 && duty.missingRanks.length > 0 && (
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {duty.missingRanks.includes(1)
            ? "Keine Vertretung eingeteilt"
            : `${duty.missingRanks.length} Ersatz fehlt`}
        </p>
      )}
    </div>
  );
}

function groupByWeek(days: BoardDay[]) {
  const map = new Map<IsoDate, BoardDay[]>();
  for (const day of days) {
    if (day.weekday >= 6) continue; // Wochenenden werden nicht dargestellt
    const start = startOfIsoWeek(day.date);
    const list = map.get(start) ?? [];
    list.push(day);
    map.set(start, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([start, list]) => ({ start, days: list }));
}
