"use client";

import * as React from "react";
import { de } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateDe, fromIsoDate, toIsoDate, weekdayShort, isoWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Datumsauswahl mit dem Kalender von shadcn/ui.
 *
 * Gegenüber `<input type="date">` bringt das drei Dinge: deutsche
 * Monats- und Wochentagsnamen unabhängig von der Spracheinstellung des
 * Browsers, eine Darstellung, die zum Rest der Oberfläche passt, und die
 * Möglichkeit, einzelne Tage zu sperren.
 *
 * Der Wert bleibt nach außen ein ISO-Datum („2026-09-14“), damit die
 * Formulare unverändert weiterarbeiten.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = "Datum wählen",
  className,
  /** Zusätzlicher Hinweis unter dem Feld, z.B. der Wochentag. */
  showWeekday = true,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showWeekday?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? fromIsoDate(value) : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-60" />
            {value ? (
              <span className="truncate">
                {formatDateDe(value)}
                {showWeekday && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {weekdayShort(isoWeekday(value))}
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={de}
            weekStartsOn={1}
            captionLayout="dropdown"
            defaultMonth={selected}
            selected={selected}
            disabled={buildDisabled(min, max)}
            onSelect={(date) => {
              if (!date) return;
              onChange(toIsoDate(date));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Grenzen als Matcher für react-day-picker, wie sie `min`/`max` vorgeben. */
function buildDisabled(min?: string, max?: string): Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (min) matchers.push({ before: fromIsoDate(min) });
  if (max) matchers.push({ after: fromIsoDate(max) });
  return matchers.length > 0 ? matchers : undefined;
}
