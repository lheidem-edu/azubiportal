import { describe, expect, it } from "vitest";
import { isoWeekday, nextWorkWeeks, startOfIsoWeek, startOfNextWeek } from "./dates";

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
