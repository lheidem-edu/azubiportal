import { addDays, toIsoDate, type IsoDate } from "./dates";

/**
 * Gesetzliche Feiertage in Nordrhein-Westfalen.
 *
 * Die beweglichen Feiertage werden über den Ostersonntag berechnet
 * (Gaußsche Osterformel in der Fassung von Lichtenberg), damit die Anwendung
 * ohne externe Datenquelle für jedes Jahr korrekte Termine liefert.
 */

export type HolidayDefinition = {
  date: IsoDate;
  name: string;
};

/** Ostersonntag des angegebenen Jahres (gregorianischer Kalender). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate(new Date(year, month - 1, day, 12));
}

/**
 * Alle gesetzlichen Feiertage in NRW für ein Jahr.
 * Ostersonntag und Pfingstsonntag fallen immer auf einen Sonntag und sind
 * für die Planung ohne Bedeutung, werden aber der Vollständigkeit halber
 * nicht aufgeführt.
 */
export function nrwHolidays(year: number): HolidayDefinition[] {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, name: "Neujahr" },
    { date: addDays(easter, -2), name: "Karfreitag" },
    { date: addDays(easter, 1), name: "Ostermontag" },
    { date: `${year}-05-01`, name: "Tag der Arbeit" },
    { date: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { date: addDays(easter, 50), name: "Pfingstmontag" },
    { date: addDays(easter, 60), name: "Fronleichnam" },
    { date: `${year}-10-03`, name: "Tag der Deutschen Einheit" },
    { date: `${year}-11-01`, name: "Allerheiligen" },
    { date: `${year}-12-25`, name: "1. Weihnachtstag" },
    { date: `${year}-12-26`, name: "2. Weihnachtstag" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function nrwHolidaysForYears(years: number[]): HolidayDefinition[] {
  return years.flatMap((y) => nrwHolidays(y));
}
