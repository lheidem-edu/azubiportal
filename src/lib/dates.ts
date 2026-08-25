/**
 * Alle Datumsangaben in der Anwendung sind kalendarische Tage ohne Uhrzeit und
 * werden als ISO-String "YYYY-MM-DD" gespeichert und weitergereicht. Damit
 * gibt es keine Zeitzonen-Überraschungen zwischen Server, DB und Browser.
 */

export type IsoDate = string;

export const TIMEZONE = "Europe/Berlin";

const WEEKDAY_LABELS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function toIsoDate(value: Date | string): IsoDate {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Erzeugt ein Date-Objekt um 12:00 Uhr lokal – robust gegen DST-Sprünge. */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(iso: IsoDate): number {
  const day = fromIsoDate(iso).getDay();
  return day === 0 ? 7 : day;
}

export function isWeekend(iso: IsoDate): boolean {
  return isoWeekday(iso) >= 6;
}

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 4000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function startOfIsoWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

export function endOfIsoWeek(iso: IsoDate): IsoDate {
  return addDays(startOfIsoWeek(iso), 6);
}

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m, 0, 12);
  return toIsoDate(d);
}

/** ISO-Kalenderwoche nach DIN 1355 / ISO 8601. */
export function isoWeekNumber(iso: IsoDate): number {
  const d = fromIsoDate(iso);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Anzahl ganzer Wochen zwischen zwei Tagen (für 14-tägige Rhythmen). */
export function weeksBetween(from: IsoDate, to: IsoDate): number {
  const a = fromIsoDate(startOfIsoWeek(from)).getTime();
  const b = fromIsoDate(startOfIsoWeek(to)).getTime();
  return Math.round((b - a) / (7 * 86400000));
}

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? "?";
}

export function weekdayShort(weekday: number): string {
  return WEEKDAY_SHORT[weekday - 1] ?? "?";
}

export function formatDateDe(iso: IsoDate): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatDateLongDe(iso: IsoDate): string {
  return `${weekdayLabel(isoWeekday(iso))}, ${formatDateDe(iso)}`;
}

export function formatRangeDe(start: IsoDate, end: IsoDate): string {
  return start === end ? formatDateDe(start) : `${formatDateDe(start)} – ${formatDateDe(end)}`;
}

/** "08:30:00" -> "08:30" */
export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export function rangesOverlap(
  aStart: IsoDate,
  aEnd: IsoDate,
  bStart: IsoDate,
  bEnd: IsoDate,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Montag der nächsten Woche. Grundlage der Planung: Die laufende Woche ist in
 * der Regel schon geplant, geplant wird ab der kommenden.
 */
export function startOfNextWeek(from: IsoDate = today()): IsoDate {
  return addDays(startOfIsoWeek(from), 7);
}

/**
 * Zeitraum über eine Anzahl Arbeitswochen ab der nächsten Woche – jeweils von
 * Montag bis Freitag, das Ende fällt auf den letzten Freitag.
 */
export function nextWorkWeeks(weeks: number, from: IsoDate = today()) {
  const start = startOfNextWeek(from);
  const safeWeeks = Math.max(1, Math.round(weeks));
  return { start, end: addDays(start, (safeWeeks - 1) * 7 + 4) };
}
