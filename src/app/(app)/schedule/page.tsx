import Link from "next/link";
import { ArrowUp, ChevronLeft, ChevronRight, UserRoundX } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PlanBoard } from "@/components/app/plan-board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addDays, formatDateDe, startOfIsoWeek, today } from "@/lib/dates";
import { getPlanBoard } from "@/lib/scheduler/service";
import { getSetting } from "@/lib/settings";
import { DeskFeed } from "@/components/app/desk-feed";
import { requireUser } from "@/lib/session";
import { canPlan } from "@/lib/auth";
import { SLOT_KIND_LABEL } from "@/lib/labels";

export const metadata = { title: "Vertretungsplan" };

const WEEK_OPTIONS = [1, 2, 4, 8];

export default async function PlanPage(props: PageProps<"/schedule">) {
  const user = await requireUser();
  const params = await props.searchParams;

  const weeks = clampWeeks(params.weeks);
  const start = startOfIsoWeek(
    typeof params.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
      ? params.from
      : today(),
  );
  const end = addDays(start, weeks * 7 - 1);
  const [days, calendar] = await Promise.all([
    getPlanBoard(start, end),
    getSetting("calendar"),
  ]);

  const href = (from: string, w = weeks) => `/schedule?from=${from}&weeks=${w}`;

  return (
    <>
      <PageHeader
        title="Vertretungsplan"
        description={`${formatDateDe(start)} – ${formatDateDe(end)}`}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" asChild aria-label="Frühere Wochen">
                <Link href={href(addDays(start, -7 * weeks))}>
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={href(startOfIsoWeek(today()))}>Heute</Link>
              </Button>
              <Button variant="outline" size="icon" asChild aria-label="Spätere Wochen">
                <Link href={href(addDays(start, 7 * weeks))}>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {WEEK_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={option === weeks ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link href={href(start, option)}>{option} Wo.</Link>
                </Button>
              ))}
            </div>
          </div>
        }
      />

      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary inline-block size-1.5 rounded-full" />
          übernimmt die Zentrale
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowUp className="text-primary size-3" />
          nachgerückt, weil jemand ausfällt
        </span>
        <span className="flex items-center gap-1.5">
          <UserRoundX className="text-destructive/70 size-3" />
          fällt aus
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
            {SLOT_KIND_LABEL.FULL_DAY}
          </Badge>
          Festbesetzung fehlt, Vertretung den ganzen Tag
        </span>
      </div>

      <PlanBoard
        days={days}
        today={today()}
        highlightApprenticeId={user.apprenticeId}
        editable={canPlan(user.role)}
      />

      {calendar.deskFeedToken && (
        <div className="mt-8 max-w-xl">
          <DeskFeed token={calendar.deskFeedToken} />
        </div>
      )}
    </>
  );
}

function clampWeeks(value: unknown): number {
  const parsed = Number(value);
  return WEEK_OPTIONS.includes(parsed) ? parsed : 2;
}
