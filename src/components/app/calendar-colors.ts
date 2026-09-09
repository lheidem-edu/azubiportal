import type { MarkKind, YearDay } from "@/lib/year-marks";

/**
 * Farbsprache der Kalenderansichten. Sie steht an einer Stelle, damit die
 * Monatsübersicht aller Beteiligten und der eigene Jahresüberblick dasselbe
 * bedeuten, wenn sie dasselbe zeigen.
 */

/** Farbe je Abwesenheitsart – feste Werte, damit sie hell wie dunkel tragen. */
export const MARK_COLOR: Record<MarkKind, string> = {
  VACATION: "bg-emerald-500",
  SICK: "bg-rose-500",
  SCHOOL: "bg-sky-400",
  TRAINING: "bg-violet-500",
  OTHER: "bg-amber-500",
};

/**
 * Hintergrund eines Tages im Raster.
 *
 * Feiertage und Betriebsferien heben sich am stärksten ab – an ihnen wird gar
 * nicht gearbeitet. Schulferien bekommen denselben Farbton, aber blasser: Sie
 * betreffen nur den Berufsschulunterricht, die Auszubildenden sind da.
 * Wochenenden bleiben neutral grau.
 */
export function dayBackground(day: Pick<YearDay, "isWeekend" | "holiday" | "closure" | "schoolHoliday">): string {
  if (day.holiday || day.closure) return "bg-amber-500/25";
  if (day.schoolHoliday) return "bg-amber-500/10";
  if (day.isWeekend) return "bg-muted";
  return "bg-muted/25";
}
