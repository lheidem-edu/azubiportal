import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { companyClosures, publicHolidays } from "@/db/schema";
import { nrwHolidays } from "@/lib/holidays";
import type { IsoDate } from "@/lib/dates";

/**
 * Feiertage werden für jedes Jahr aus der Osterformel berechnet – es gibt
 * deshalb keinen Zeitpunkt, ab dem die Planung ohne Feiertage dasteht.
 *
 * Die Tabelle `public_holidays` enthält nur noch Abweichungen davon:
 *   • zusätzliche, betriebseigene Feiertage (`source = MANUAL`)
 *   • abgeschaltete oder umbenannte Feiertage (`source = AUTO`, `isActive`)
 */

export type EffectiveHoliday = {
  date: IsoDate;
  name: string;
  region: string;
  isActive: boolean;
  /** AUTO = gesetzlicher Feiertag in NRW, MANUAL = selbst eingetragen. */
  source: "AUTO" | "MANUAL";
  /** Liegt für diesen Tag ein abweichender Eintrag in der Datenbank? */
  hasOverride: boolean;
};

function yearsBetween(from: IsoDate, to: IsoDate): number[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  const years: number[] = [];
  for (let year = first; year <= last; year++) years.push(year);
  return years;
}

/**
 * Alle Feiertage eines Zeitraums – berechnet und mit den Anpassungen aus der
 * Datenbank zusammengeführt. Enthält auch abgeschaltete Tage; zum Planen
 * `resolveHolidays` verwenden.
 */
export async function listEffectiveHolidays(
  from: IsoDate,
  to: IsoDate,
  region = "NRW",
): Promise<EffectiveHoliday[]> {
  const overrides = await db
    .select()
    .from(publicHolidays)
    .where(
      and(
        eq(publicHolidays.region, region),
        gte(publicHolidays.date, from),
        lte(publicHolidays.date, to),
      ),
    );
  const overrideByDate = new Map(overrides.map((row) => [row.date, row]));

  const merged = new Map<IsoDate, EffectiveHoliday>();

  for (const year of yearsBetween(from, to)) {
    for (const holiday of nrwHolidays(year)) {
      if (holiday.date < from || holiday.date > to) continue;
      const override = overrideByDate.get(holiday.date);
      merged.set(holiday.date, {
        date: holiday.date,
        // Ein hinterlegter Name gewinnt, damit sich Bezeichnungen anpassen lassen.
        name: override?.name ?? holiday.name,
        region,
        isActive: override?.isActive ?? true,
        source: "AUTO",
        hasOverride: Boolean(override),
      });
    }
  }

  // Einträge, die nicht auf einen berechneten Feiertag fallen, sind zusätzlich.
  for (const row of overrides) {
    if (merged.has(row.date)) continue;
    merged.set(row.date, {
      date: row.date,
      name: row.name,
      region,
      isActive: row.isActive,
      source: "MANUAL",
      hasOverride: true,
    });
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Die tatsächlich geltenden Feiertage eines Zeitraums – Grundlage der Planung. */
export async function resolveHolidays(
  from: IsoDate,
  to: IsoDate,
  region = "NRW",
): Promise<{ date: IsoDate; name: string }[]> {
  const all = await listEffectiveHolidays(from, to, region);
  return all.filter((h) => h.isActive).map(({ date, name }) => ({ date, name }));
}

export async function listClosures() {
  return db.select().from(companyClosures).orderBy(companyClosures.startDate);
}

export async function isBlockedDay(date: IsoDate) {
  const [holiday] = await resolveHolidays(date, date);
  if (holiday) return { blocked: true as const, reason: holiday.name };

  const [closure] = await db
    .select()
    .from(companyClosures)
    .where(
      and(
        lte(companyClosures.startDate, date),
        gte(companyClosures.endDate, date),
        eq(companyClosures.blocksPlanning, true),
      ),
    )
    .limit(1);
  if (closure) return { blocked: true as const, reason: closure.name };

  return { blocked: false as const };
}
