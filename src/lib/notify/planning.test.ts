import { describe, expect, it } from "vitest";
import { buildSickReportText, gapsFromBoard, type CoverageGap } from "./planning";
import type { BoardDay, BoardEntry } from "@/lib/scheduler/service";

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

function day(entries: BoardEntry[], over: Partial<BoardDay> = {}): BoardDay {
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

describe("Unbesetzte Tage finden", () => {
  it("meldet nichts, solange jemand übernimmt", () => {
    expect(gapsFromBoard([day([entry()])])).toEqual([]);
  });

  it("meldet einen Tag, an dem alle Eingeteilten ausgefallen sind", () => {
    const gaps = gapsFromBoard([
      day([
        entry({ rank: 1, apprenticeName: "Anna Becker", droppedOut: true, isActing: false }),
        entry({ rank: 2, apprenticeName: "Ben Hoffmann", droppedOut: true, isActing: false }),
      ]),
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].dutyLabel).toBe("Pausenvertretung");
    expect(gaps[0].droppedOut).toEqual(["Anna Becker", "Ben Hoffmann"]);
  });

  it("meldet keine Lücke, wenn jemand nachgerückt ist", () => {
    const gaps = gapsFromBoard([
      day([
        entry({ rank: 1, droppedOut: true, isActing: false }),
        entry({ rank: 2, apprenticeName: "Clara Vogt", isActing: true, isStandIn: true }),
      ]),
    ]);
    expect(gaps).toEqual([]);
  });

  it("hält noch nicht geplante Tage für keine Lücke", () => {
    // Jenseits des Planungshorizonts ist schlicht nichts eingeteilt – das ist
    // kein Handlungsbedarf, sonst meldete jeder Lauf hunderte Tage.
    expect(gapsFromBoard([day([])])).toEqual([]);
  });

  it("überspringt Tage ohne Vertretungsbedarf", () => {
    const feiertag = day([], { isWorkday: false, holidayName: "Fronleichnam" });
    expect(gapsFromBoard([feiertag])).toEqual([]);
  });
});

describe("Text der Krankmeldung", () => {
  const report = {
    personName: "Anna Becker",
    isDeskStaff: false,
    startDate: "2026-09-14",
    endDate: "2026-09-16",
    reason: "Grippe",
    reportedBy: "Anna Becker",
  };

  it("nennt Person, Zeitraum und Grund", () => {
    const text = buildSickReportText(report, []);
    expect(text).toContain("Anna Becker");
    expect(text).toContain("14.09.2026 – 16.09.2026");
    expect(text).toContain("Grippe");
  });

  it("sagt ausdrücklich, wenn nichts zu tun ist", () => {
    expect(buildSickReportText(report, [])).toContain("es ist nichts zu tun");
  });

  it("zählt die unbesetzten Tage auf", () => {
    const gaps: CoverageGap[] = [
      { date: "2026-09-15", dutyLabel: "Pausenvertretung", droppedOut: ["Anna Becker"] },
    ];
    const text = buildSickReportText(report, gaps);
    expect(text).toContain("Achtung");
    expect(text).toContain("Dienstag, 15.09.2026");
    expect(text).toContain("ausgefallen: Anna Becker");
    expect(text).toContain("Entscheidung von Hand");
  });

  it("weist auf die Festbesetzung hin", () => {
    const text = buildSickReportText({ ...report, isDeskStaff: true }, []);
    expect(text).toContain("ganztägige Vertretung");
  });
});
