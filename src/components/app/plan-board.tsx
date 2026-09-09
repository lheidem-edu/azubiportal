import Link from "next/link";
import { ArrowUp, CalendarOff, Lock, Pencil, Sun, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDateDe,
  formatTime,
  isoWeekNumber,
  startOfIsoWeek,
  weekdayLabel,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import type { BoardDay, BoardDuty } from "@/lib/scheduler/service";
import { rankLabel, SLOT_KIND_LABEL } from "@/lib/labels";

/**
 * Wochenweise Plantafel. Jede Karte ist ein Tag.
 *
 * Der Aufbau folgt der Frage, die beim Blick auf den Plan zuerst kommt:
 * Wer übernimmt? Diese Person steht deshalb hervorgehoben allein auf einer
 * Zeile; Ersatzleute stehen zusammengefasst darunter, Ausfälle darüber.
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
    <div className="space-y-6">
      {weeks.map((week) => (
        <section key={week.start}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-heading text-sm font-semibold">KW {isoWeekNumber(week.start)}</h2>
            <span className="text-muted-foreground text-xs">
              {formatDateDe(week.days[0].date)} – {formatDateDe(week.days.at(-1)!.date)}
            </span>
          </div>
          {/* Auf breiten Schirmen steht die Woche als Zeile – so wie man sie liest. */}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
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
        "bg-card flex flex-col overflow-hidden rounded-lg border",
        isToday && "border-primary ring-primary/25 ring-2",
        !day.isWorkday && "bg-muted/30 border-dashed",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 border-b px-2.5 py-1.5",
          isToday && "bg-primary/5",
        )}
      >
        <span className="text-sm font-medium">
          <span className="xl:hidden">{weekdayLabel(day.weekday)}</span>
          <span className="hidden xl:inline">{weekdayShort(day.weekday)}</span>
        </span>
        <span className="text-muted-foreground text-xs">{formatDateDe(day.date).slice(0, 6)}</span>

        <div className="ml-auto flex items-center gap-1">
          {day.requiresFullDay && day.isWorkday && (
            <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
              <UserRoundX className="size-3" />
              {SLOT_KIND_LABEL.FULL_DAY}
            </Badge>
          )}
          {editable && day.isWorkday && (
            <Link
              href={{ pathname: "/planning", query: { day: day.date } }}
              aria-label={`${weekdayLabel(day.weekday)}, ${formatDateDe(day.date)} bearbeiten`}
              title="Tag bearbeiten"
              className="text-muted-foreground hover:bg-accent hover:text-foreground -mr-1 rounded p-1"
            >
              <Pencil className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      {!day.isWorkday ? (
        <div className="text-muted-foreground flex flex-1 items-center gap-1.5 px-2.5 py-3 text-xs">
          {day.holidayName ? (
            <Sun className="size-3.5 shrink-0" />
          ) : (
            <CalendarOff className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {day.holidayName ?? day.closureName ?? day.skipReason}
          </span>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 p-2.5">
          {day.absentStaff.length > 0 && (
            <p className="text-muted-foreground text-[11px]">
              Ausfall: {day.absentStaff.join(", ")}
            </p>
          )}
          {day.duties.map((duty) => (
            <DutyBlock key={duty.key} duty={duty} highlightApprenticeId={highlightApprenticeId} />
          ))}
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
  const acting = duty.entries.find((entry) => entry.isActing);
  const dropped = duty.entries.filter((entry) => entry.droppedOut);
  const standby = duty.entries.filter((entry) => !entry.droppedOut && !entry.isActing);
  const times = duty.times
    .map((time) => `${formatTime(time.startTime)}–${formatTime(time.endTime)}`)
    .join(" · ");

  return (
    <div>
      {/* Bezeichnung und Zeiten teilen sich eine Zeile – sie gehören zusammen. */}
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {duty.label}
        </span>
        <span className="text-muted-foreground text-[11px] tabular-nums">{times}</span>
      </div>

      {duty.entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">Noch nicht geplant</p>
      ) : (
        <>
          {dropped.length > 0 && (
            <p className="text-destructive/70 mb-0.5 flex items-start gap-1 text-[11px]">
              <UserRoundX className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span className="line-through">
                {dropped.map((entry) => entry.apprenticeName).join(", ")}
              </span>
            </p>
          )}

          {acting ? (
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm leading-snug font-medium",
                highlightApprenticeId === acting.apprenticeId && "text-primary",
              )}
            >
              <span className="bg-primary inline-block size-1.5 shrink-0 rounded-full" aria-hidden />
              <span className="truncate">{acting.apprenticeName}</span>
              {acting.isStandIn && (
                <span
                  className="text-primary flex shrink-0 items-center gap-0.5 text-[10px] font-medium"
                  title="Nachgerückt, weil die eingeteilte Person ausfällt"
                >
                  <ArrowUp className="size-3" />
                  springt ein
                </span>
              )}
              {acting.isLocked && (
                <Lock className="text-muted-foreground size-3 shrink-0" aria-label="gesperrt" />
              )}
            </p>
          ) : (
            <p className="text-destructive text-sm leading-snug font-medium">Nicht besetzt</p>
          )}

          {/* Ersatzleute stehen zusammengefasst in einer Zeile. */}
          {(standby.length > 0 || duty.missingBackups > 0) && (
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              <span className="font-medium">Ersatz:</span>{" "}
              {standby.map((entry, index) => (
                <span key={entry.rank}>
                  {index > 0 && ", "}
                  <span
                    className={cn(
                      highlightApprenticeId === entry.apprenticeId && "text-primary font-medium",
                    )}
                  >
                    {entry.apprenticeName}
                  </span>
                </span>
              ))}
              {standby.length === 0 && "–"}
              {duty.missingBackups > 0 && (
                <span className="text-destructive/80">
                  {standby.length > 0 ? " · " : " "}
                  {duty.missingBackups} fehlt
                </span>
              )}
            </p>
          )}

          {duty.derivedFrom && (
            <p className="text-muted-foreground mt-0.5 text-[10px] italic">
              übernimmt {rankLabel(duty.derivedFrom.rank)}
            </p>
          )}
        </>
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
