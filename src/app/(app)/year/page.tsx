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
import { YearGrid } from "./year-grid";

export const metadata = { title: "Jahresübersicht" };

export default async function YearPage(props: PageProps<"/year">) {
  const user = await requireUser();
  const params = await props.searchParams;

  const currentYear = new Date().getFullYear();
  const parsed = Number(params.year);
  const year = Number.isInteger(parsed) && parsed > 2000 && parsed < 2200 ? parsed : currentYear;

  const overview = await getYearOverview(year);
  const people = sortPeople(overview.people);
  const ownId = user.apprenticeId ?? user.deskStaffId;

  return (
    <>
      <PageHeader
        title="Jahresübersicht"
        description="Wer ist wann nicht da – Urlaub, Krankmeldungen, Schultage und Lehrgänge aller Beteiligten."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild aria-label="Vorheriges Jahr">
              <Link href={{ pathname: "/year", query: { year: year - 1 } }}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button variant={year === currentYear ? "default" : "outline"} size="sm" asChild>
              <Link href="/year">{currentYear}</Link>
            </Button>
            <Button variant="outline" size="icon" asChild aria-label="Nächstes Jahr">
              <Link href={{ pathname: "/year", query: { year: year + 1 } }}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{year}</CardTitle>
          <CardDescription>Seitlich scrollen, um durch das Jahr zu blättern.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {people.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Es sind noch keine Personen angelegt.
            </p>
          ) : (
            <YearGrid overview={{ ...overview, people }} today={today()} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summen {year}</CardTitle>
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
                  <TableHead>Urlaubstage</TableHead>
                  <TableHead>Krankheitstage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
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
                      {person.vacationDays.toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {person.sickDays.toLocaleString("de-DE")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>
    </>
  );
}
