import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { apprentices, notifications } from "@/db/schema";
import { formatDateLongDe, formatTime, today, type IsoDate } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { getAssignments, type AssignmentView } from "@/lib/scheduler/service";
import { enumerateDe, rankLabel } from "@/lib/labels";
import { sendMail } from "./email";
import { sendTeamsCard } from "./teams";

export { sendMail, verifySmtp } from "./email";
export { sendTeamsCard, buildAdaptiveCard } from "./teams";
export { rankLabel } from "@/lib/labels";

function baseUrl() {
  return (process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/* -------------------------------------------------------------------------- */
/* Nachrichtentexte                                                           */
/* -------------------------------------------------------------------------- */

export function buildReminderText(name: string, date: IsoDate, entries: AssignmentView[]) {
  const primary = entries.filter((e) => e.rank === 1);
  const backup = entries.filter((e) => e.rank > 1);

  const lines: string[] = [`Hallo ${name.split(" ")[0]},`, ""];

  if (primary.length > 0) {
    lines.push(`heute, ${formatDateLongDe(date)}, übernimmst du die Zentrale:`);
    for (const entry of primary) {
      lines.push(
        `  • ${entry.slotLabel}: ${formatTime(entry.startTime)}–${formatTime(entry.endTime)} Uhr`,
      );
    }
    lines.push("");
  }
  if (backup.length > 0) {
    lines.push(
      primary.length > 0
        ? "Außerdem bist du als Ersatz eingeteilt:"
        : `heute, ${formatDateLongDe(date)}, bist du als Ersatz eingeteilt:`,
    );
    for (const entry of backup) {
      lines.push(
        `  • ${entry.slotLabel} (${rankLabel(entry.rank)}): ${formatTime(entry.startTime)}–${formatTime(entry.endTime)} Uhr`,
      );
    }
    lines.push("");
  }
  lines.push(`Deinen vollständigen Plan findest du hier: ${baseUrl()}/my-schedule`);
  return lines.join("\n");
}

export function buildReminderHtml(name: string, date: IsoDate, entries: AssignmentView[]) {
  const row = (entry: AssignmentView) =>
    `<tr>
      <td style="padding:6px 12px 6px 0;">${entry.slotLabel}</td>
      <td style="padding:6px 12px 6px 0;">${formatTime(entry.startTime)}–${formatTime(entry.endTime)} Uhr</td>
      <td style="padding:6px 0;"><strong>${rankLabel(entry.rank)}</strong></td>
    </tr>`;
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;color:#111;">
    <p>Hallo ${name.split(" ")[0]},</p>
    <p>deine Einteilung für <strong>${formatDateLongDe(date)}</strong>:</p>
    <table style="border-collapse:collapse;">${entries.map(row).join("")}</table>
    <p style="margin-top:16px;">
      <a href="${baseUrl()}/my-schedule" style="color:#0b5cad;">Vollständigen Plan öffnen</a>
    </p>
  </div>`;
}

export function buildReminderCard(name: string, date: IsoDate, entries: AssignmentView[]) {
  const primary = entries.filter((e) => e.rank === 1);
  return {
    title:
      primary.length > 0
        ? `Du übernimmst heute: ${enumerateDe([...new Set(primary.map((e) => e.slotLabel))])}`
        : "Du bist heute als Ersatz eingeteilt",
    subtitle: formatDateLongDe(date),
    facts: entries.map((e) => ({
      name: e.slotLabel,
      value: `${formatTime(e.startTime)}–${formatTime(e.endTime)} Uhr · ${rankLabel(e.rank)}`,
    })),
    text: `Hallo ${name.split(" ")[0]}, bitte denk an deine Einteilung.`,
    linkUrl: `${baseUrl()}/my-schedule`,
    linkTitle: "Meinen Plan öffnen",
  };
}

/* -------------------------------------------------------------------------- */
/* Versand                                                                    */
/* -------------------------------------------------------------------------- */

type DispatchResult = {
  date: IsoDate;
  sent: number;
  skipped: number;
  failed: number;
  details: { apprentice: string; channel: string; status: string; error?: string }[];
};

/**
 * Verschickt die Morgenerinnerungen für einen Tag. Der Versand ist über den
 * `dedupeKey` gegen Doppelversand abgesichert, kann also gefahrlos mehrfach
 * angestoßen werden.
 */
export async function dispatchDailyReminders(
  date: IsoDate = today(),
  opts: { force?: boolean } = {},
): Promise<DispatchResult> {
  const [reminders, teamsSettings, smtpSettings] = await Promise.all([
    getSetting("reminders"),
    getSetting("teams"),
    getSetting("smtp"),
  ]);
  const emailReady = smtpSettings.enabled && Boolean(smtpSettings.host);
  const teamsReady = teamsSettings.enabled;
  const result: DispatchResult = { date, sent: 0, skipped: 0, failed: 0, details: [] };

  if (!reminders.enabled && !opts.force) {
    result.details.push({
      apprentice: "-",
      channel: "-",
      status: "Erinnerungen sind deaktiviert",
    });
    return result;
  }

  const entries = await getAssignments(date, date);
  const relevant = reminders.notifyBackups ? entries : entries.filter((e) => e.rank === 1);
  if (relevant.length === 0) return result;

  const byApprentice = new Map<string, AssignmentView[]>();
  for (const entry of relevant) {
    const list = byApprentice.get(entry.apprenticeId) ?? [];
    list.push(entry);
    byApprentice.set(entry.apprenticeId, list);
  }

  const people = await db.query.apprentices.findMany();
  const peopleById = new Map(people.map((p) => [p.id, p]));

  for (const [apprenticeId, list] of byApprentice) {
    const person = peopleById.get(apprenticeId);
    if (!person) continue;
    const sorted = [...list].sort((a, b) => a.rank - b.rank || a.sortOrder - b.sortOrder);

    if (person.notifyEmail && person.email && !emailReady) {
      result.skipped += 1;
      result.details.push({
        apprentice: person.displayName,
        channel: "E-Mail",
        status: "SKIPPED",
        error: "SMTP ist nicht konfiguriert.",
      });
    } else if (person.notifyEmail && person.email) {
      const outcome = await deliver({
        apprenticeId,
        channel: "EMAIL",
        target: person.email,
        dedupeKey: `reminder:${date}:${apprenticeId}`,
        force: opts.force,
        subject: subjectFor(sorted, date),
        body: buildReminderText(person.displayName, date, sorted),
        send: () =>
          sendMail({
            to: person.email,
            subject: subjectFor(sorted, date),
            text: buildReminderText(person.displayName, date, sorted),
            html: buildReminderHtml(person.displayName, date, sorted),
          }),
      });
      tally(result, person.displayName, "E-Mail", outcome);
    }

    const webhook = person.teamsWebhookUrl || teamsSettings.defaultWebhookUrl;
    if (person.notifyTeams && teamsReady && webhook) {
      const card = buildReminderCard(person.displayName, date, sorted);
      const outcome = await deliver({
        apprenticeId,
        channel: "TEAMS",
        target: webhook,
        dedupeKey: `reminder:${date}:${apprenticeId}`,
        force: opts.force,
        subject: card.title,
        body: JSON.stringify(card.facts),
        send: () => sendTeamsCard(webhook, card),
      });
      tally(result, person.displayName, "Teams", outcome);
    }
  }

  return result;
}

/**
 * Der Betreff nennt die Slots so, wie sie konfiguriert sind – dadurch passt er
 * auch, wenn andere Zeiten oder Bezeichnungen eingerichtet wurden.
 */
function subjectFor(entries: AssignmentView[], date: IsoDate) {
  const primary = entries.filter((e) => e.rank === 1);
  const labels = enumerateDe([...new Set((primary.length > 0 ? primary : entries).map((e) => e.slotLabel))]);
  if (primary.length === 0) {
    return `Ersatz für die Zentrale am ${formatDateLongDe(date)}${labels ? ` (${labels})` : ""}`;
  }
  return `${labels} am ${formatDateLongDe(date)}`;
}

type DeliverInput = {
  apprenticeId: string;
  channel: "EMAIL" | "TEAMS";
  target: string;
  dedupeKey: string;
  subject: string;
  body: string;
  force?: boolean;
  send: () => Promise<{ ok: boolean; error?: string }>;
};

async function deliver(input: DeliverInput) {
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.dedupeKey, input.dedupeKey),
      eq(notifications.channel, input.channel),
    ),
  });
  if (existing && existing.status === "SENT" && !input.force) {
    return { status: "SKIPPED" as const, error: undefined };
  }

  const outcome = await input.send();
  const values = {
    apprenticeId: input.apprenticeId,
    channel: input.channel,
    target: input.target,
    subject: input.subject,
    body: input.body,
    status: outcome.ok ? ("SENT" as const) : ("FAILED" as const),
    error: outcome.ok ? null : (outcome.error ?? "Unbekannter Fehler"),
    sentAt: outcome.ok ? new Date() : null,
    dedupeKey: input.dedupeKey,
  };
  await db
    .insert(notifications)
    .values(values)
    .onConflictDoUpdate({
      target: [notifications.dedupeKey, notifications.channel],
      set: values,
    });
  return { status: values.status, error: values.error ?? undefined };
}

function tally(
  result: DispatchResult,
  apprentice: string,
  channel: string,
  outcome: { status: string; error?: string },
) {
  if (outcome.status === "SENT") result.sent++;
  else if (outcome.status === "SKIPPED") result.skipped++;
  else result.failed++;
  result.details.push({ apprentice, channel, status: outcome.status, error: outcome.error });
}

/** Verlauf der letzten Benachrichtigungen für die Verwaltungsansicht. */
export async function recentNotifications(limit = 50) {
  return db
    .select({
      id: notifications.id,
      channel: notifications.channel,
      target: notifications.target,
      subject: notifications.subject,
      status: notifications.status,
      error: notifications.error,
      sentAt: notifications.sentAt,
      createdAt: notifications.createdAt,
      apprenticeName: apprentices.displayName,
    })
    .from(notifications)
    .leftJoin(apprentices, eq(notifications.apprenticeId, apprentices.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/** Zählt offene Fehler im Versand – für den Hinweis im Dashboard. */
export async function failedNotificationCount(since: IsoDate) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.status, "FAILED"), gte(notifications.createdAt, new Date(since))));
  return rows.length;
}
