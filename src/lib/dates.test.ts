import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isoWeekday, nextWorkWeeks, startOfIsoWeek, startOfNextWeek } from "./dates";

describe("Planungszeiträume", () => {
  it("beginnt am Montag der kommenden Woche", () => {
    // 26.08.2026 ist ein Mittwoch
    expect(startOfNextWeek("2026-08-26")).toBe("2026-08-31");
    expect(isoWeekday(startOfNextWeek("2026-08-26"))).toBe(1);
  });

  it("beginnt auch am Sonntag erst in der Folgewoche", () => {
    // 30.08.2026 ist ein Sonntag – die „nächste" Woche ist der 31.08.
    expect(startOfNextWeek("2026-08-30")).toBe("2026-08-31");
  });

  it("beginnt am Montag mit der darauffolgenden Woche", () => {
    expect(startOfNextWeek("2026-08-31")).toBe("2026-09-07");
  });

  it("umfasst eine Arbeitswoche von Montag bis Freitag", () => {
    const range = nextWorkWeeks(1, "2026-08-26");
    expect(range).toEqual({ start: "2026-08-31", end: "2026-09-04" });
    expect(isoWeekday(range.end)).toBe(5);
  });

  it("umfasst bei zwei Wochen den Freitag der zweiten Woche", () => {
    const range = nextWorkWeeks(2, "2026-08-26");
    expect(range).toEqual({ start: "2026-08-31", end: "2026-09-11" });
    expect(isoWeekday(range.end)).toBe(5);
    expect(startOfIsoWeek(range.end)).toBe("2026-09-07");
  });

  it("rechnet mit mindestens einer Woche", () => {
    expect(nextWorkWeeks(0, "2026-08-26").end).toBe("2026-09-04");
  });
});

describe("Tagesabstand", () => {
  it("zählt die Tage zwischen zwei Daten", () => {
    expect(daysBetween("2026-09-14", "2026-09-18")).toBe(4);
    expect(daysBetween("2026-09-14", "2026-09-14")).toBe(0);
  });

  it("zählt rückwärts negativ", () => {
    expect(daysBetween("2026-09-18", "2026-09-14")).toBe(-4);
  });

  it("kommt mit der Zeitumstellung zurecht", () => {
    // Ende der Sommerzeit 2026: Nacht auf den 25.10.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    // Beginn der Sommerzeit 2026: Nacht auf den 29.03.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("behält die Länge eines Zeitraums beim Verschieben", () => {
    // So verschiebt die Planung das Ende, wenn der Beginn nach hinten rutscht.
    const laenge = daysBetween("2026-09-14", "2026-09-18");
    expect(addDays("2026-09-21", laenge)).toBe("2026-09-25");
  });
});
