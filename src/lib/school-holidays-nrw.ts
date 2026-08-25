import type { IsoDate } from "@/lib/dates";

/**
 * Schulferien in Nordrhein-Westfalen.
 *
 * Anders als die gesetzlichen Feiertage lassen sich Ferien nicht berechnen –
 * sie werden vom Schulministerium festgelegt. Die Termine stammen aus dessen
 * offenem Datensatz „OpenData_Ferientermine" und reichen bis zum Schuljahr
 * 2029/30. Danach müssen sie in der Verwaltung nachgetragen werden.
 *
 * Quelle: https://www.schulministerium.nrw/ferienordnung-fuer-nordrhein-westfalen-fuer-die-schuljahre-bis-202930
 */

export type SchoolHolidayDefinition = {
  schoolYear: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
};

/** Die FerienID des Datensatzes bezeichnet den Ferienabschnitt. */
const SECTION_NAMES: Record<number, string> = {
  1: "Sommerferien",
  2: "Herbstferien",
  3: "Weihnachtsferien",
  4: "Osterferien",
  5: "Pfingstferien",
};

/** [Schuljahr, FerienID, Beginn, Ende] – unverändert aus dem Datensatz. */
const RAW: [string, number, IsoDate, IsoDate][] = [
  ["2023/24", 1, "2023-06-22", "2023-08-04"],
  ["2023/24", 2, "2023-10-02", "2023-10-14"],
  ["2023/24", 3, "2023-12-21", "2024-01-05"],
  ["2023/24", 4, "2024-03-25", "2024-04-06"],
  ["2023/24", 5, "2024-05-21", "2024-05-21"],
  ["2024/25", 1, "2024-07-08", "2024-08-20"],
  ["2024/25", 2, "2024-10-14", "2024-10-26"],
  ["2024/25", 3, "2024-12-23", "2025-01-06"],
  ["2024/25", 4, "2025-04-14", "2025-04-26"],
  ["2024/25", 5, "2025-06-10", "2025-06-10"],
  ["2025/26", 1, "2025-07-14", "2025-08-26"],
  ["2025/26", 2, "2025-10-13", "2025-10-25"],
  ["2025/26", 3, "2025-12-22", "2026-01-06"],
  ["2025/26", 4, "2026-03-30", "2026-04-11"],
  ["2025/26", 5, "2026-05-26", "2026-05-26"],
  ["2026/27", 1, "2026-07-20", "2026-09-01"],
  ["2026/27", 2, "2026-10-17", "2026-10-31"],
  ["2026/27", 3, "2026-12-23", "2027-01-06"],
  ["2026/27", 4, "2027-03-22", "2027-04-03"],
  ["2026/27", 5, "2027-05-18", "2027-05-18"],
  ["2027/28", 1, "2027-07-19", "2027-08-31"],
  ["2027/28", 2, "2027-10-23", "2027-11-06"],
  ["2027/28", 3, "2027-12-24", "2028-01-08"],
  ["2027/28", 4, "2028-04-10", "2028-04-22"],
  ["2028/29", 1, "2028-07-10", "2028-08-22"],
  ["2028/29", 2, "2028-10-23", "2028-11-04"],
  ["2028/29", 3, "2028-12-21", "2029-01-05"],
  ["2028/29", 4, "2029-03-26", "2029-04-07"],
  ["2028/29", 5, "2029-05-22", "2029-05-22"],
  ["2029/30", 1, "2029-07-02", "2029-08-14"],
  ["2029/30", 2, "2029-10-15", "2029-10-27"],
  ["2029/30", 3, "2029-12-20", "2030-01-04"],
  ["2029/30", 4, "2030-04-15", "2030-04-27"],
];

export const NRW_SCHOOL_HOLIDAYS: SchoolHolidayDefinition[] = RAW.map(
  ([schoolYear, section, startDate, endDate]) => ({
    schoolYear,
    name: SECTION_NAMES[section] ?? "Ferien",
    startDate,
    endDate,
  }),
);

/** Bis wann die hinterlegten Termine reichen. */
export const NRW_SCHOOL_HOLIDAYS_UNTIL: IsoDate =
  NRW_SCHOOL_HOLIDAYS.reduce<IsoDate>((latest, entry) => (entry.endDate > latest ? entry.endDate : latest), "0000-00-00");
