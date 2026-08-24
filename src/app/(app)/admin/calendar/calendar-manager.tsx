"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/app/table-scroll";
import { ConfirmButton } from "@/components/app/confirm-button";
import {
  createClosure,
  createHoliday,
  deleteClosure,
  resetHoliday,
  setHolidayActive,
} from "@/app/actions/calendar";
import { useAction } from "@/lib/use-action";
import { formatDateDe, formatRangeDe, today, weekdayShort, isoWeekday } from "@/lib/dates";

export type HolidayRow = {
  date: string;
  name: string;
  region: string;
  isActive: boolean;
  source: "AUTO" | "MANUAL";
  /** Weicht der Tag von der Berechnung ab? Nur dann gibt es etwas zurückzusetzen. */
  hasOverride: boolean;
};

export type ClosureRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  blocksPlanning: boolean;
  note: string | null;
};

export function CalendarManager({
  holidays,
  closures,
  year,
}: {
  holidays: HolidayRow[];
  closures: ClosureRow[];
  year: number;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const refresh = () => router.refresh();
  const currentYear = new Date().getFullYear();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Feiertage {year}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" asChild aria-label="Vorheriges Jahr">
                <Link href={{ pathname: "/admin/calendar", query: { year: year - 1 } }}>
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/calendar">{currentYear}</Link>
              </Button>
              <Button variant="outline" size="icon" asChild aria-label="Nächstes Jahr">
                <Link href={{ pathname: "/admin/calendar", query: { year: year + 1 } }}>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <CardDescription>
            Die gesetzlichen Feiertage in NRW werden für jedes Jahr berechnet – auch weit in der
            Zukunft. Hier hinterlegte Änderungen überstimmen die Berechnung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ManualHolidayForm year={year} onDone={refresh} />

          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Feiertag</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead className="w-1" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((row) => (
                  <TableRow key={row.date} className={row.isActive ? undefined : "opacity-60"}>
                    <TableCell className="tabular-nums">
                      {formatDateDe(row.date)}
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {weekdayShort(isoWeekday(row.date))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.name}
                      {row.source === "MANUAL" && (
                        <Badge variant="outline" className="ml-2 h-5">
                          eigener Eintrag
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isActive}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          execute(() => setHolidayActive(row.date, checked), { onSuccess: refresh })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {row.hasOverride && (
                        <ConfirmButton
                          size="icon"
                          disabled={pending}
                          title={
                            row.source === "MANUAL" ? "Eintrag löschen?" : "Anpassung zurücknehmen?"
                          }
                          description={
                            row.source === "MANUAL"
                              ? "Der selbst eingetragene Feiertag wird entfernt."
                              : "Danach gilt für diesen Tag wieder der berechnete gesetzliche Feiertag."
                          }
                          confirmLabel={row.source === "MANUAL" ? "Löschen" : "Zurücksetzen"}
                          onConfirm={() =>
                            execute(() => resetHoliday(row.date), { onSuccess: refresh })
                          }
                        >
                          {row.source === "MANUAL" ? (
                            <Trash2 className="size-4" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                        </ConfirmButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Betriebsferien</CardTitle>
          <CardDescription>
            In diesen Zeiträumen wird keine Vertretung geplant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ClosureForm onDone={refresh} />

          {closures.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Keine Betriebsferien eingetragen.
            </p>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead className="w-1" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        {!row.blocksPlanning && (
                          <Badge variant="outline" className="h-5">
                            Planung läuft weiter
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatRangeDe(row.startDate, row.endDate)}</TableCell>
                      <TableCell>
                        <ConfirmButton
                          size="icon"
                          disabled={pending}
                          title="Betriebsferien löschen?"
                          confirmLabel="Löschen"
                          onConfirm={() =>
                            execute(() => deleteClosure(row.id), { onSuccess: refresh })
                          }
                        >
                          <Trash2 className="size-4" />
                        </ConfirmButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManualHolidayForm({ year, onDone }: { year: number; onDone: () => void }) {
  const { pending, execute } = useAction();
  const currentYear = new Date().getFullYear();
  const [date, setDate] = useState(year === currentYear ? today() : `${year}-01-01`);
  const [name, setName] = useState("");

  return (
    <form
      className="grid gap-2 sm:flex sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        execute(() => createHoliday({ date, name, region: "NRW" }), {
          onSuccess: () => {
            setName("");
            onDone();
          },
        });
      }}
    >
      <Input
        type="date"
        className="w-full sm:w-40"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <Input
        className="w-full sm:w-48"
        required
        placeholder="Bezeichnung"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full sm:w-auto">
        <CalendarPlus className="size-4" />
        Ergänzen
      </Button>
    </form>
  );
}

function ClosureForm({ onDone }: { onDone: () => void }) {
  const { pending, execute } = useAction();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());

  return (
    <form
      className="grid gap-3 sm:flex sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        execute(() => createClosure({ name, startDate, endDate, blocksPlanning: true }), {
          onSuccess: () => {
            setName("");
            onDone();
          },
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="closureName">Bezeichnung</Label>
        <Input
          id="closureName"
          required
          className="w-full sm:w-48"
          placeholder="z.B. Weihnachtsferien"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="closureFrom">Von</Label>
        <Input
          id="closureFrom"
          type="date"
          className="w-full sm:w-40"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            if (event.target.value > endDate) setEndDate(event.target.value);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="closureTo">Bis</Label>
        <Input
          id="closureTo"
          type="date"
          className="w-full sm:w-40"
          min={startDate}
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        Hinzufügen
      </Button>
    </form>
  );
}
