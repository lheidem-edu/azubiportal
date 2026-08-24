import { createHash } from "node:crypto";
import type { AssignmentView } from "@/lib/scheduler/service";
import { formatTime, type IsoDate } from "@/lib/dates";
import { rankLabel } from "@/lib/labels";
import { APP_NAME } from "@/lib/app-config";

/**
 * Minimaler ICS-Generator (RFC 5545) für den persönlichen Kalenderfeed.
 * Outlook abonniert die URL und aktualisiert den Plan dann selbstständig.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zeilen dürfen laut RFC höchstens 75 Oktette lang sein. */
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 74) return line;
  const chars = [...line];
  const out: string[] = [];
  let current = "";
  for (const char of chars) {
    if (Buffer.byteLength(current + char, "utf8") > 73) {
      out.push(current);
      current = " " + char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

function stampUtc(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** "2026-09-07" + "09:00:00" -> "20260907T090000" (lokale Zeit, mit TZID) */
function localDateTime(date: IsoDate, time: string): string {
  return `${date.replace(/-/g, "")}T${time.slice(0, 8).replace(/:/g, "")}`;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "X-LIC-LOCATION:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export type IcsOptions = {
  calendarName: string;
  /** Erinnerung X Minuten vor Beginn (0 = keine). */
  alarmMinutes?: number;
  /** Auch Ersatz-Nominierungen aufnehmen. */
  includeBackups?: boolean;
  baseUrl?: string;
};

export function buildIcsFeed(entries: AssignmentView[], options: IcsOptions): string {
  const {
    calendarName,
    alarmMinutes = 15,
    includeBackups = true,
    baseUrl = "",
  } = options;

  const selected = includeBackups ? entries : entries.filter((e) => e.rank === 1);
  const stamp = stampUtc();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${APP_NAME}//Vertretungsplan//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...VTIMEZONE,
  ];

  for (const entry of selected) {
    const isPrimary = entry.rank === 1;
    const summary = isPrimary
      ? `Zentrale: ${entry.slotLabel}`
      : `Zentrale: ${entry.slotLabel} (${rankLabel(entry.rank)})`;
    const description = isPrimary
      ? `Du übernimmst die Zentrale (${formatTime(entry.startTime)}–${formatTime(entry.endTime)} Uhr).`
      : `Du bist ${rankLabel(entry.rank)} für die Zentrale und springst nur bei Ausfall ein.`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.id}@azubiportal`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Berlin:${localDateTime(entry.date, entry.startTime)}`,
      `DTEND;TZID=Europe/Berlin:${localDateTime(entry.date, entry.endTime)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "LOCATION:Zentrale",
      `CATEGORIES:${isPrimary ? "Vertretung" : "Ersatz"}`,
      `STATUS:${entry.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      `TRANSP:${isPrimary ? "OPAQUE" : "TRANSPARENT"}`,
      `SEQUENCE:${sequenceFor(entry)}`,
      ...(baseUrl ? [`URL:${baseUrl}/my-schedule`] : []),
    );

    if (isPrimary && alarmMinutes > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(summary)}`,
        `TRIGGER:-PT${alarmMinutes}M`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Ändert sich der Eintrag, steigt die Sequenznummer und Outlook aktualisiert. */
function sequenceFor(entry: AssignmentView): number {
  const hash = createHash("sha1")
    .update(`${entry.apprenticeId}|${entry.rank}|${entry.startTime}|${entry.endTime}|${entry.status}`)
    .digest();
  return hash.readUInt16BE(0);
}
