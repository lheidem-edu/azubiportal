import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScroll } from "@/components/app/table-scroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/session";
import { today } from "@/lib/dates";
import { getYearOverview, sortPeople } from "@/lib/year-overview";
import { buildMonthView, monthTotals, MONTH_NAMES } from "@/lib/year-marks";
import { MonthCalendar } from "./month-calendar";

export const metadata = { title: "Monatsübersicht" };

/** Verschiebt einen Monat um n Schritte, über Jahresgrenzen hinweg. */
function shiftMonth(year: number, month: number, step: number) {
  const index = (year * 12 + (month - 1) + step) % (12 * 10000);
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const now = today();

  const currentYear = Number(now.slice(0, 4));
  const currentMonth = Number(now.slice(5, 7));

  const parsedYear = Number(params.year);
  const parsedMonth = Number(params.month);
  const year =
    Number.isInteger(parsedYear) && parsedYear > 2000 && parsedYear < 2200 ? parsedYear : currentYear;
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : currentMonth;

  const overview = await getYearOverview(year);
  const view = buildMonthView({ ...overview, people: sortPeople(overview.people) }, month);
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const ownId = user.apprenticeId ?? user.deskStaffId;

  return (
    <>
      <PageHeader
        title="Monatsübersicht"
        description="Wer ist wann nicht da – Urlaub, Krankmeldungen, Schultage und Lehrgänge aller Beteiligten."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild aria-label="Vorheriger Monat">
              <Link href={{ pathname: "/calendar", query: previous }}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button
              variant={year === currentYear && month === currentMonth ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href="/calendar">Heute</Link>
            </Button>
            <Button variant="outline" size="icon" asChild aria-label="Nächster Monat">
              <Link href={{ pathname: "/calendar", query: next }}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
          <CardDescription>
            Auf einen Tag tippen, um Grund und angerechnete Tage zu sehen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view.people.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Es sind noch keine Personen angelegt.
            </p>
          ) : (
            <MonthCalendar view={view} today={now} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summen</CardTitle>
          <CardDescription>
            Gezählt werden nur Tage, an denen die Person tatsächlich da wäre – bei der
            Zentrale-Besetzung also nur ihre eigenen Wochentage. Halbe Tage zählen halb.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Urlaub im Monat</TableHead>
                  <TableHead>Krank im Monat</TableHead>
                  <TableHead>Urlaub {year}</TableHead>
                  <TableHead>Krank {year}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.people.map((person) => {
                  const totals = monthTotals(person, view.days);
                  return (
                    <TableRow key={`${person.kind}:${person.id}`}>
                      <TableCell>
                        <span className="font-medium">{person.name}</span>
                        {person.kind === "DESK" && (
                          <Badge variant="secondary" className="ml-2 h-5">
                            Zentrale
                          </Badge>
                        )}
                        {person.id === ownId && (
                          <Badge variant="outline" className="ml-2 h-5">
                            du
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {totals.vacation.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {totals.sick.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {person.vacationDays.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {person.sickDays.toLocaleString("de-DE")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>
    </>
  );
}
