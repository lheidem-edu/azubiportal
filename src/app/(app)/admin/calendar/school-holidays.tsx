"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/app/date-picker";
import { ConfirmButton } from "@/components/app/confirm-button";
import {
  createSchoolHoliday,
  deleteSchoolHoliday,
  importSchoolHolidays,
} from "@/app/actions/calendar";
import { useAction } from "@/lib/use-action";
import { formatRangeDe, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type SchoolHolidayRow = {
  id: string;
  name: string;
  schoolYear: string | null;
  startDate: string;
  endDate: string;
  source: string;
  /** Leer heißt: gilt für alle Auszubildenden. */
  apprenticeNames: string[];
};

export type ApprenticeOption = { id: string; name: string };

/**
 * Schulferien in NRW. Sie lassen sich nicht berechnen, sondern stammen aus der
 * Ferienordnung des Schulministeriums; die Termine sind mitgeliefert und
 * lassen sich hier ergänzen oder entfernen.
 */
export function SchoolHolidayList({
  rows,
  coveredUntil,
  apprentices,
}: {
  rows: SchoolHolidayRow[];
  coveredUntil: string;
  apprentices: ApprenticeOption[];
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const now = today();

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Für dieses Jahr sind keine Ferien hinterlegt.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const past = row.endDate < now;
            return (
              <li
                key={row.id}
                className={cn("flex items-center justify-between gap-3 py-2", past && "opacity-60")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.name}</span>
                    {row.schoolYear && (
                      <Badge variant="outline" className="h-5">
                        {row.schoolYear}
                      </Badge>
                    )}
                    {row.source === "MANUAL" && (
                      <Badge variant="secondary" className="h-5">
                        eigener Eintrag
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatRangeDe(row.startDate, row.endDate)}
                    {row.apprenticeNames.length > 0 && (
                      <> · nur {row.apprenticeNames.join(", ")}</>
                    )}
                  </div>
                </div>
                <ConfirmButton
                  size="icon"
                  disabled={pending}
                  title="Ferien entfernen?"
                  description="In diesem Zeitraum gelten die Berufsschultage danach wieder."
                  confirmLabel="Entfernen"
                  onConfirm={() =>
                    execute(() => deleteSchoolHoliday(row.id), { onSuccess: () => router.refresh() })
                  }
                >
                  <Trash2 className="size-4" />
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}

      <SchoolFreeDayForm apprentices={apprentices} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            execute(() => importSchoolHolidays(), { onSuccess: () => router.refresh() })
          }
        >
          <Download className="size-4" />
          Ferienordnung einlesen
        </Button>
        <span className="text-muted-foreground text-xs">
          Mitgelieferte Termine reichen bis {formatRangeDe(coveredUntil, coveredUntil)}.
        </span>
      </div>
    </div>
  );
}

/**
 * Einzelne schulfreie Tage: bewegliche Ferientage und pädagogische Tage. Die
 * Schule bleibt zu, der Betrieb nicht – die Auszubildenden sind an solchen
 * Tagen also da und können die Zentrale übernehmen.
 */
function SchoolFreeDayForm({ apprentices }: { apprentices: ApprenticeOption[] }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [name, setName] = useState("Beweglicher Ferientag");
  const [date, setDate] = useState(today());
  const [until, setUntil] = useState(today());
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  return (
    <form
      className="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:flex sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        execute(
          () =>
            createSchoolHoliday({
              name,
              startDate: date,
              endDate: until,
              apprenticeIds: selected,
            }),
          {
            onSuccess: () => {
              setName("Beweglicher Ferientag");
              setSelected([]);
              router.refresh();
            },
          },
        );
      }}
    >
      <div className="space-y-1.5 sm:w-56">
        <Label htmlFor="freeDayName">Schulfreier Tag</Label>
        <Input
          id="freeDayName"
          required
          value={name}
          placeholder="z.B. Pädagogischer Tag"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <DatePicker
        id="freeDayFrom"
        label="Von"
        className="sm:w-44"
        value={date}
        onChange={(value) => {
          setDate(value);
          if (value > until) setUntil(value);
        }}
      />
      <DatePicker
        id="freeDayTo"
        label="Bis"
        className="sm:w-44"
        min={date}
        value={until}
        onChange={setUntil}
      />
      <div className="space-y-1.5 sm:w-full">
        <Label>Gilt für</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelected([])}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              selected.length === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent",
            )}
          >
            Alle
          </button>
          {apprentices.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected.includes(person.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent",
              )}
            >
              {person.name}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Bewegliche Ferientage und pädagogische Tage legt jede Schule für sich fest – wähle die
          Auszubildenden aus, die dorthin gehen. Ohne Auswahl gilt der Tag für alle.
        </p>
      </div>

      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full sm:w-auto">
        <Plus className="size-4" />
        Eintragen
      </Button>
    </form>
  );
}
