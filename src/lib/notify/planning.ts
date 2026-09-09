import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  addDays,
  formatDateLongDe,
  formatRangeDe,
  today,
  type IsoDate,
} from "@/lib/dates";
import { getPlanBoard, type BoardDay } from "@/lib/scheduler/service";
import { APP_NAME } from "@/lib/app-config";
import { deliver } from "./index";
import { sendMail } from "./email";

/**
 * Hinweise an die Planung.
 *
 * Zwei Anlässe: Jemand meldet sich krank, oder ein Arbeitstag steht ohne
 * Vertretung da. Beides braucht eine Entscheidung von Hand, deshalb geht es an
 * die Personen, die den Plan verantworten – und nur an die, die das auch
 * möchten (`users.notifyPlanning`).
 */

export type PlanningRecipient = { id: string; name: string; email: string };

export async function planningRecipients(): Promise<PlanningRecipient[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        or(eq(users.role, "ADMIN"), eq(users.role, "PLANNER")),
        eq(users.notifyPlanning, true),
        eq(users.isActive, true),
      ),
    );
  return rows.filter((row) => row.email.includes("@"));
}

/** Ein Arbeitstag, an dem ein Dienst niemanden hat, der ihn übernimmt. */
export type CoverageGap = {
  date: IsoDate;
  dutyLabel: string;
  /** Eingeteilte, die ausgefallen sind – erklärt, warum die Lücke entstand. */
  droppedOut: string[];
};

export async function findCoverageGaps(from: IsoDate, to: IsoDate): Promise<CoverageGap[]> {
  const board = await getPlanBoard(from, to);
  return gapsFromBoard(board);
}

/** Getrennt von der Abfrage, damit die Regel für sich prüfbar bleibt. */
export function gapsFromBoard(board: BoardDay[]): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const day of board) {
    if (!day.isWorkday) continue;
    for (const duty of day.duties) {
      // Nur wo etwas geplant war und trotzdem niemand übrig ist. Tage jenseits
      // des Planungshorizonts sind noch gar nicht besetzt und keine Lücke.
      if (duty.entries.length === 0 || duty.hasActing) continue;
      gaps.push({
        date: day.date,
        dutyLabel: duty.label,
        droppedOut: duty.entries
          .filter((entry) => entry.droppedOut)
          .map((entry) => entry.apprenticeName),
      });
    }
  }
  return gaps;
}

function baseUrl() {
  return (process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function buildGapLines(gaps: CoverageGap[]): string[] {
  return gaps.map((gap) => {
    const reason = gap.droppedOut.length > 0 ? ` (ausgefallen: ${gap.droppedOut.join(", ")})` : "";
    return `  • ${formatDateLongDe(gap.date)} – ${gap.dutyLabel}${reason}`;
  });
}

/* -------------------------------------------------------------------------- */
/* Krankmeldung                                                               */
/* -------------------------------------------------------------------------- */

export type SickReport = {
  personName: string;
  isDeskStaff: boolean;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string | null;
  /** Wer die Meldung eingetragen hat. */
  reportedBy: string;
};

export function buildSickReportText(report: SickReport, gaps: CoverageGap[]): string {
  const lines = [
    `${report.personName} hat sich für ${formatRangeDe(report.startDate, report.endDate)} krankgemeldet.`,
  ];
  if (report.reason) lines.push(`Bemerkung: ${report.reason}`);
  lines.push("");

  if (report.isDeskStaff) {
    lines.push(
      "Es handelt sich um die feste Besetzung der Zentrale – für diese Tage wird eine ganztägige Vertretung gebraucht.",
      "",
    );
  }

  if (gaps.length > 0) {
    lines.push(
      gaps.length === 1
        ? "Achtung: Für diesen Tag steht derzeit niemand zur Verfügung:"
        : `Achtung: Für ${gaps.length} Tage steht derzeit niemand zur Verfügung:`,
      ...buildGapLines(gaps),
      "",
      "Diese Tage brauchen eine Entscheidung von Hand.",
    );
  } else {
    lines.push("Die Vertretung ist für den Zeitraum weiterhin besetzt; es ist nichts zu tun.");
  }

  lines.push("", `Zum Plan: ${baseUrl()}/planning`);
  return lines.join("\n");
}

/**
 * Meldet eine Krankmeldung an die Planung und prüft dabei gleich, ob dadurch
 * ein Tag unbesetzt bleibt.
 */
export async function notifySickReport(report: SickReport) {
  const recipients = await planningRecipients();
  if (recipients.length === 0) return { sent: 0, gaps: 0 };

  const gaps = await findCoverageGaps(report.startDate, report.endDate);
  const subject =
    gaps.length > 0
      ? `Krankmeldung ${report.personName} – ${gaps.length} Tag(e) ohne Vertretung`
      : `Krankmeldung ${report.personName} (${formatRangeDe(report.startDate, report.endDate)})`;
  const body = buildSickReportText(report, gaps);

  let sent = 0;
  for (const recipient of recipients) {
    const outcome = await deliver({
      userId: recipient.id,
      channel: "EMAIL",
      target: recipient.email,
      // Je Meldung und Empfänger einmal – ein zweiter Aufruf schickt nicht erneut.
      dedupeKey: `sick:${report.startDate}:${report.personName}:${recipient.id}`,
      subject,
      body,
      send: () => sendMail({ to: recipient.email, subject, text: body }),
    });
    if (outcome.status === "SENT") sent++;
  }
  return { sent, gaps: gaps.length };
}

/* -------------------------------------------------------------------------- */
/* Tägliche Prüfung auf unbesetzte Tage                                       */
/* -------------------------------------------------------------------------- */

export function buildGapAlertText(gaps: CoverageGap[], from: IsoDate, to: IsoDate): string {
  return [
    `Für den Zeitraum ${formatRangeDe(from, to)} sind Tage ohne Vertretung geplant:`,
    "",
    ...buildGapLines(gaps),
    "",
    `Zum Plan: ${baseUrl()}/planning`,
  ].join("\n");
}

/**
 * Prüft die kommenden Tage auf unbesetzte Dienste und meldet sie. Der
 * Abgleichschlüssel enthält die betroffenen Tage: Solange sich nichts ändert,
 * kommt die Meldung nur einmal.
 */
export async function notifyCoverageGaps(days = 14, from: IsoDate = today()) {
  const to = addDays(from, days);
  const gaps = await findCoverageGaps(from, to);
  if (gaps.length === 0) return { sent: 0, gaps: 0 };

  const recipients = await planningRecipients();
  if (recipients.length === 0) return { sent: 0, gaps: gaps.length };

  const fingerprint = gaps.map((gap) => `${gap.date}|${gap.dutyLabel}`).join(",");
  const subject = `${APP_NAME}: ${gaps.length} Tag(e) ohne Vertretung`;
  const body = buildGapAlertText(gaps, from, to);

  let sent = 0;
  for (const recipient of recipients) {
    const outcome = await deliver({
      userId: recipient.id,
      channel: "EMAIL",
      target: recipient.email,
      dedupeKey: `gaps:${recipient.id}:${fingerprint}`,
      subject,
      body,
      send: () => sendMail({ to: recipient.email, subject, text: body }),
    });
    if (outcome.status === "SENT") sent++;
  }
  return { sent, gaps: gaps.length };
}
