import { describe, expect, it } from "vitest";
import { buildIcsFeed, buildMasterIcsFeed } from "./ics";
import type { AssignmentView, BoardDay, BoardEntry } from "@/lib/scheduler/service";

function assignment(over: Partial<AssignmentView> = {}): AssignmentView {
  return {
    id: "a1",
    date: "2026-09-14",
    rank: 1,
    status: "PLANNED",
    isLocked: false,
    isManual: false,
    note: null,
    apprenticeId: "p1",
    apprenticeName: "Anna Becker",
    slotId: "s1",
    slotKey: "BREAKFAST",
    slotLabel: "Frühstückspause",
    slotKind: "BREAK",
    startTime: "09:00:00",
    endTime: "09:30:00",
    sortOrder: 10,
    droppedOut: false,
    isActing: true,
    isStandIn: false,
    standsInFor: null,
    ...over,
  };
}

function entry(over: Partial<BoardEntry> = {}): BoardEntry {
  return {
    rank: 1,
    apprenticeId: "p1",
    apprenticeName: "Anna Becker",
    isLocked: false,
    isManual: false,
    assignmentIds: ["a1"],
    droppedOut: false,
    isActing: true,
    isStandIn: false,
    ...over,
  };
}

function boardDay(entries: BoardEntry[], over: Partial<BoardDay> = {}): BoardDay {
  return {
    date: "2026-09-14",
    weekday: 1,
    isWorkday: true,
    absentStaff: [],
    requiresFullDay: false,
    duties: [
      {
        key: "BREAKS",
        label: "Pausenvertretung",
        kind: "BREAK",
        slotIds: ["s1"],
        times: [
          { slotId: "s1", label: "Frühstückspause", startTime: "09:00:00", endTime: "09:30:00" },
        ],
        backupCount: 2,
        entries,
        hasActing: entries.some((e) => e.isActing),
        missingBackups: 0,
      },
    ],
    ...over,
  };
}

/**
 * Lange Zeilen werden im ICS umgebrochen und in der Folgezeile mit einem
 * Leerzeichen fortgesetzt. Zum Prüfen des Inhalts wird das rückgängig gemacht.
 */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

/** Zeilen dürfen laut RFC 5545 höchstens 75 Oktette lang sein. */
function longLines(ics: string): string[] {
  return ics.split("\r\n").filter((line) => Buffer.byteLength(line, "utf8") > 75);
}

describe("Persönlicher Kalender", () => {
  it("nennt die eigene Einteilung als festen Termin", () => {
    const ics = buildIcsFeed([assignment()], { calendarName: "Test" });
    expect(ics).toContain("SUMMARY:Zentrale: Frühstückspause");
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20260914T090000");
    expect(ics).toContain("TRANSP:OPAQUE");
  });

  it("macht aus dem Ersatz einen unverbindlichen Termin", () => {
    const ics = buildIcsFeed(
      [assignment({ rank: 2, isActing: false })],
      { calendarName: "Test" },
    );
    expect(ics).toContain("TRANSP:TRANSPARENT");
    expect(ics).toContain("(1. Ersatz)");
  });

  it("macht daraus einen festen Termin, sobald die Person einspringt", () => {
    const ics = buildIcsFeed(
      [assignment({ rank: 2, isActing: true, isStandIn: true, standsInFor: "Ben Hoffmann" })],
      { calendarName: "Test" },
    );
    expect(ics).toContain("TRANSP:OPAQUE");
    expect(ics).toContain("Einspringen");
    expect(ics).toContain("für Ben Hoffmann");
  });

  it("hält die Zeilenlänge ein", () => {
    const ics = buildIcsFeed(
      [assignment({ apprenticeName: "Von-und-zu-Hohenlohe-Langenburg, Maximiliane" })],
      { calendarName: "Ein sehr langer Kalendername für die Zentrale des Betriebs" },
    );
    expect(longLines(ics)).toEqual([]);
  });
});

describe("Kalender der Zentrale", () => {
  it("nennt im Betreff die Person, die übernimmt", () => {
    const ics = buildMasterIcsFeed([boardDay([entry()])], { calendarName: "Zentrale" });
    expect(ics).toContain("SUMMARY:Frühstückspause: Anna Becker");
  });

  it("nennt Ausfall und Ersatz in der Beschreibung", () => {
    const ics = buildMasterIcsFeed(
      [
        boardDay([
          entry({ rank: 1, apprenticeName: "Ben Hoffmann", droppedOut: true, isActing: false }),
          entry({ rank: 2, apprenticeName: "David Krüger", isStandIn: true }),
          entry({ rank: 3, apprenticeName: "Clara Vogt", isActing: false }),
        ]),
      ],
      { calendarName: "Zentrale" },
    );
    const text = unfold(ics);
    expect(text).toContain("SUMMARY:Frühstückspause: David Krüger");
    expect(text).toContain("David Krüger (eingesprungen)");
    expect(text).toContain("Ausgefallen: Ben Hoffmann");
    expect(text).toContain("Ersatz: Clara Vogt");
  });

  it("lässt noch nicht geplante Tage weg", () => {
    // Sonst besteht der Kalender fast nur aus „nicht besetzt“ und die echten
    // Einträge gehen darin unter.
    const ics = buildMasterIcsFeed([boardDay([])], { calendarName: "Zentrale" });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("zeigt eine echte Lücke aber an", () => {
    const ics = buildMasterIcsFeed(
      [boardDay([entry({ droppedOut: true, isActing: false })])],
      { calendarName: "Zentrale" },
    );
    expect(ics).toContain("nicht besetzt");
  });

  it("überspringt Tage ohne Vertretungsbedarf", () => {
    const ics = buildMasterIcsFeed(
      [boardDay([entry()], { isWorkday: false, holidayName: "Fronleichnam" })],
      { calendarName: "Zentrale" },
    );
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("Maskierung nach RFC 5545", () => {
  it("maskiert Semikolon, Komma und Backslash", () => {
    const ics = buildMasterIcsFeed(
      [boardDay([entry({ apprenticeName: "Meier; Anna, B\\C" })])],
      { calendarName: "Zentrale" },
    );
    const summary = unfold(ics)
      .split("\r\n")
      .find((line) => line.startsWith("SUMMARY:"));
    // Unmaskiert würde das Semikolon den Wert beenden und den Termin zerlegen.
    // Im Quelltext braucht der Backslash selbst eine Verdopplung – genau die
    // fehlte in der Maskierfunktion und ließ Semikolons unmaskiert durch.
    expect(summary).toContain("Meier\\; Anna\\, B\\\\C");
  });

  it("maskiert Zeilenumbrüche statt sie durchzureichen", () => {
    const ics = buildMasterIcsFeed(
      [
        boardDay([
          entry({ apprenticeName: "Anna" }),
          entry({ rank: 2, apprenticeName: "Ben", isActing: false }),
        ]),
      ],
      { calendarName: "Zentrale" },
    );
    const description = unfold(ics)
      .split("\r\n")
      .find((line) => line.startsWith("DESCRIPTION:"));
    expect(description).toContain("\\n");
    // Ein echter Umbruch würde die Eigenschaft beenden.
    expect(description).not.toMatch(/[\r\n]/);
  });
});
