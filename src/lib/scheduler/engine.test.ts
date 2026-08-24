import { describe, expect, it } from "vitest";
import { generatePlan } from "./engine";
import type { SchedulerInput, SchedulerApprentice, SchedulerSlot } from "./types";
import { easterSunday, nrwHolidays } from "@/lib/holidays";

const BREAKFAST: SchedulerSlot = {
  id: "slot-breakfast",
  key: "BREAKFAST",
  label: "Frühstückspause",
  kind: "BREAK",
  startTime: "09:00",
  endTime: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  weight: 1,
  backupCount: 2,
  isActive: true,
  sortOrder: 10,
};

const LUNCH: SchedulerSlot = {
  ...BREAKFAST,
  id: "slot-lunch",
  key: "LUNCH",
  label: "Mittagspause",
  startTime: "12:00",
  endTime: "12:45",
  sortOrder: 20,
};

const FULL_DAY: SchedulerSlot = {
  ...BREAKFAST,
  id: "slot-full",
  key: "FULL_DAY",
  label: "Ganztägige Vertretung",
  kind: "FULL_DAY",
  startTime: "08:00",
  endTime: "17:00",
  weight: 4,
  sortOrder: 30,
};

function apprentice(id: string, name: string, over: Partial<SchedulerApprentice> = {}) {
  return {
    id,
    displayName: name,
    startDate: "2020-01-01",
    endDate: null,
    isPlannable: true,
    loadFactor: 1,
    loadOffset: 0,
    ...over,
  } satisfies SchedulerApprentice;
}

function baseInput(over: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    rangeStart: "2026-09-07", // Montag
    rangeEnd: "2026-09-11", // Freitag
    apprentices: [
      apprentice("a", "Anna"),
      apprentice("b", "Ben"),
      apprentice("c", "Clara"),
      apprentice("d", "David"),
    ],
    slots: [BREAKFAST, LUNCH, FULL_DAY],
    schoolTerms: [],
    absences: [],
    deskShifts: [
      { staffId: "s1", staffName: "Person A", weekday: 1, validFrom: "2020-01-01", validTo: null },
      { staffId: "s1", staffName: "Person A", weekday: 2, validFrom: "2020-01-01", validTo: null },
      { staffId: "s1", staffName: "Person A", weekday: 3, validFrom: "2020-01-01", validTo: null },
      { staffId: "s2", staffName: "Person B", weekday: 4, validFrom: "2020-01-01", validTo: null },
      { staffId: "s2", staffName: "Person B", weekday: 5, validFrom: "2020-01-01", validTo: null },
    ],
    deskAbsences: [],
    holidays: [],
    closures: [],
    existingAssignments: [],
    ...over,
  };
}

describe("Feiertagsberechnung NRW", () => {
  it("berechnet den Ostersonntag korrekt", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("liefert Feiertage auch weit in der Zukunft", () => {
    // Es gibt keinen Stichtag, ab dem der Kalender leer läuft.
    for (const year of [2029, 2035, 2040, 2075, 2099]) {
      const holidays = nrwHolidays(year);
      expect(holidays).toHaveLength(11);
      expect(holidays.every((h) => h.date.startsWith(String(year)))).toBe(true);
      expect(new Set(holidays.map((h) => h.date)).size).toBe(11);
    }
    // Stichproben gegen unabhängig bekannte Termine
    expect(easterSunday(2030)).toBe("2030-04-21");
    expect(easterSunday(2040)).toBe("2040-04-01");
    expect(nrwHolidays(2030).find((h) => h.name === "Fronleichnam")?.date).toBe("2030-06-20");
  });

  it("enthält Fronleichnam und Allerheiligen (NRW-spezifisch)", () => {
    const holidays = nrwHolidays(2026);
    const names = holidays.map((h) => h.name);
    expect(names).toContain("Fronleichnam");
    expect(names).toContain("Allerheiligen");
    expect(holidays.find((h) => h.name === "Fronleichnam")?.date).toBe("2026-06-04");
    expect(holidays).toHaveLength(11);
  });
});

describe("Planungs-Engine", () => {
  it("plant je Arbeitstag eine Vertretung und zwei Ersatzleute für alle Pausen zusammen", () => {
    const result = generatePlan(baseInput());
    const workdays = result.days.filter((d) => d.isWorkday);
    expect(workdays).toHaveLength(5);
    for (const day of workdays) {
      expect(day.duties).toHaveLength(1); // Frühstück und Mittag als ein Dienst
      const duty = day.duties[0];
      expect(duty.times.map((t) => t.slotId)).toEqual([BREAKFAST.id, LUNCH.id]);
      expect(duty.assigned.map((a) => a.rank)).toEqual([1, 2, 3]);
      expect(new Set(duty.assigned.map((a) => a.apprenticeId)).size).toBe(3);
    }
  });

  it("setzt für Frühstücks- und Mittagspause dieselbe Person ein", () => {
    const result = generatePlan(baseInput());
    for (const date of ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]) {
      const ofDay = result.assignments.filter((a) => a.date === date && a.rank === 1);
      expect(ofDay).toHaveLength(2); // ein Datensatz je Pause …
      expect(ofDay[0].apprenticeId).toBe(ofDay[1].apprenticeId); // … aber dieselbe Person
      expect(new Set(ofDay.map((a) => a.slotId))).toEqual(new Set([BREAKFAST.id, LUNCH.id]));
    }
  });

  it("besetzt die Pausen einzeln, wenn die Zusammenfassung abgeschaltet ist", () => {
    const result = generatePlan(baseInput({ options: { combineBreaks: false } }));
    const monday = result.days.find((d) => d.date === "2026-09-07")!;
    expect(monday.duties).toHaveLength(2);
    const breakfast = monday.duties.find((d) => d.key === "BREAKFAST")!;
    const lunch = monday.duties.find((d) => d.key === "LUNCH")!;
    expect(breakfast.assigned[0].apprenticeId).not.toBe(lunch.assigned[0].apprenticeId);
  });

  it("überspringt Feiertage auch in fernen Jahren", () => {
    const easter2042 = easterSunday(2042); // 06.04.2042
    const result = generatePlan(
      baseInput({
        rangeStart: "2042-04-04", // Karfreitag
        rangeEnd: "2042-04-07", // Ostermontag
        holidays: nrwHolidays(2042),
      }),
    );
    const byDate = new Map(result.days.map((d) => [d.date, d]));
    expect(byDate.get("2042-04-04")?.holidayName).toBe("Karfreitag");
    expect(byDate.get(easter2042)?.skipReason).toBe("Wochenende");
    expect(byDate.get("2042-04-07")?.holidayName).toBe("Ostermontag");
    expect(result.stats.daysPlanned).toBe(0);
  });

  it("überspringt Wochenenden, Feiertage und Betriebsferien", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-05-30", // Samstag
        rangeEnd: "2026-06-08",
        holidays: [{ date: "2026-06-04", name: "Fronleichnam" }],
        closures: [
          { name: "Betriebsferien", startDate: "2026-06-01", endDate: "2026-06-02", blocksPlanning: true },
        ],
      }),
    );
    const byDate = new Map(result.days.map((d) => [d.date, d]));
    expect(byDate.get("2026-05-30")?.skipReason).toBe("Wochenende");
    expect(byDate.get("2026-06-01")?.skipReason).toBe("Betriebsferien");
    expect(byDate.get("2026-06-04")?.skipReason).toBe("Feiertag");
    expect(byDate.get("2026-06-04")?.holidayName).toBe("Fronleichnam");
    expect(byDate.get("2026-06-05")?.isWorkday).toBe(true);
  });

  it("plant Auszubildende an ihren Berufsschultagen nicht ein", () => {
    const result = generatePlan(
      baseInput({
        schoolTerms: [
          { apprenticeId: "a", weekday: 1, validFrom: "2020-01-01", validTo: null, intervalWeeks: 1, anchorWeek: null },
        ],
      }),
    );
    const monday = result.days.find((d) => d.date === "2026-09-07")!;
    const involved = monday.duties.flatMap((d) => d.assigned.map((a) => a.apprenticeId));
    expect(involved).not.toContain("a");
    const tuesday = result.days.find((d) => d.date === "2026-09-08")!;
    expect(tuesday.duties.flatMap((d) => d.assigned.map((a) => a.apprenticeId))).toContain("a");
  });

  it("berücksichtigt den 14-tägigen Schulrhythmus", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-09-07",
        rangeEnd: "2026-09-21",
        schoolTerms: [
          {
            apprenticeId: "a",
            weekday: 1,
            validFrom: "2026-09-01",
            validTo: null,
            intervalWeeks: 2,
            anchorWeek: "2026-09-07",
          },
        ],
      }),
    );
    const dutyOn = (date: string) => result.days.find((d) => d.date === date)!.duties[0];
    const assignedOn = (date: string) => dutyOn(date).assigned.map((a) => a.apprenticeId);

    expect(assignedOn("2026-09-07")).not.toContain("a"); // Schulwoche
    expect(assignedOn("2026-09-21")).not.toContain("a"); // wieder Schule
    // In der freien Woche steht "a" wieder zur Verfügung
    expect(dutyOn("2026-09-07").availableCount).toBe(3);
    expect(dutyOn("2026-09-14").availableCount).toBe(4);
    const freeWeek = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].flatMap(
      assignedOn,
    );
    expect(freeWeek).toContain("a");
  });

  it("plant im Urlaub niemanden ein", () => {
    const result = generatePlan(
      baseInput({
        absences: [
          {
            apprenticeId: "b",
            type: "VACATION",
            dayPart: "FULL",
            startDate: "2026-09-07",
            endDate: "2026-09-09",
          },
        ],
      }),
    );
    const blocked = result.days
      .filter((d) => d.date <= "2026-09-09")
      .flatMap((d) => d.duties.flatMap((duty) => duty.assigned.map((a) => a.apprenticeId)));
    expect(blocked).not.toContain("b");
  });

  it("schließt bei halbtägiger Abwesenheit vom ganzen Pausendienst aus", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-09-07",
        rangeEnd: "2026-09-07",
        apprentices: [apprentice("a", "Anna"), apprentice("b", "Ben"), apprentice("c", "Clara")],
        absences: [
          {
            apprenticeId: "a",
            type: "OTHER",
            dayPart: "MORNING",
            startDate: "2026-09-07",
            endDate: "2026-09-07",
          },
        ],
      }),
    );
    // Wer nur eine der beiden Pausen könnte, kann den Tagesdienst nicht übernehmen.
    const day = result.days[0];
    expect(day.duties[0].assigned.map((a) => a.apprenticeId)).not.toContain("a");
  });

  it("blockiert bei getrennten Pausen nur die betroffene Tageshälfte", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-09-07",
        rangeEnd: "2026-09-07",
        options: { combineBreaks: false },
        apprentices: [apprentice("a", "Anna"), apprentice("b", "Ben"), apprentice("c", "Clara")],
        absences: [
          {
            apprenticeId: "a",
            type: "OTHER",
            dayPart: "MORNING",
            startDate: "2026-09-07",
            endDate: "2026-09-07",
          },
        ],
      }),
    );
    const day = result.days[0];
    const breakfast = day.duties.find((d) => d.key === "BREAKFAST")!;
    const lunch = day.duties.find((d) => d.key === "LUNCH")!;
    expect(breakfast.assigned.map((a) => a.apprenticeId)).not.toContain("a");
    expect(lunch.assigned.map((a) => a.apprenticeId)).toContain("a");
  });

  it("plant ganztägige Vertretung, wenn die Festbesetzung ausfällt", () => {
    const result = generatePlan(
      baseInput({
        deskAbsences: [{ staffId: "s1", startDate: "2026-09-08", endDate: "2026-09-08" }],
      }),
    );
    const tuesday = result.days.find((d) => d.date === "2026-09-08")!;
    expect(tuesday.requiresFullDay).toBe(true);
    expect(tuesday.absentStaff).toEqual(["Person A"]);
    expect(tuesday.duties).toHaveLength(1);
    expect(tuesday.duties[0].kind).toBe("FULL_DAY");
    expect(tuesday.duties[0].assigned).toHaveLength(3);

    const monday = result.days.find((d) => d.date === "2026-09-07")!;
    expect(monday.requiresFullDay).toBe(false);
  });

  it("verteilt die Einsätze gleichmäßig", () => {
    const result = generatePlan(
      baseInput({ rangeStart: "2026-09-07", rangeEnd: "2026-10-02" }), // 4 Wochen
    );
    const primaryCounts = new Map<string, number>();
    for (const a of result.assignments.filter((x) => x.rank === 1)) {
      primaryCounts.set(a.apprenticeId, (primaryCounts.get(a.apprenticeId) ?? 0) + 1);
    }
    const counts = [...primaryCounts.values()];
    expect(counts).toHaveLength(4);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("berücksichtigt das Gewicht der Ganztagsvertretung im Lastenausgleich", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-09-07",
        rangeEnd: "2026-09-07",
        deskAbsences: [{ staffId: "s1", startDate: "2026-09-07", endDate: "2026-09-07" }],
      }),
    );
    const primary = result.assignments.find((a) => a.rank === 1)!;
    // Ganztags zählt 4, ein Pausentag 2 – ein Ganztag wiegt also zwei Pausentage.
    expect(result.load[primary.apprenticeId].primary).toBe(4);
  });

  it("gleicht bestehende Ungleichheit aus der Historie aus", () => {
    const history = ["2026-08-31", "2026-09-01", "2026-09-02"].map((date) => ({
      id: `h-${date}`,
      date,
      slotId: BREAKFAST.id,
      rank: 1,
      apprenticeId: "a",
      isLocked: false,
      isManual: false,
    }));
    const result = generatePlan(
      baseInput({ rangeStart: "2026-09-07", rangeEnd: "2026-09-08", existingAssignments: history }),
    );
    const firstPrimary = result.days[0].duties[0].assigned.find((a) => a.rank === 1);
    expect(firstPrimary?.apprenticeId).not.toBe("a");
  });

  it("behält gesperrte Einträge unverändert bei", () => {
    const locked = {
      id: "fixed-1",
      date: "2026-09-07",
      slotId: BREAKFAST.id,
      rank: 1,
      apprenticeId: "d",
      isLocked: true,
      isManual: true,
    };
    const result = generatePlan(baseInput({ existingAssignments: [locked] }));
    const monday = result.days.find((d) => d.date === "2026-09-07")!;
    const primary = monday.duties[0].assigned.find((a) => a.rank === 1)!;
    expect(primary.apprenticeId).toBe("d");
    expect(result.stats.keptLocked).toBe(1);
    // Die Sperre gilt für den ganzen Tag: auch die Mittagspause bleibt bei "d".
    const mondayPrimaries = result.assignments.filter(
      (a) => a.date === "2026-09-07" && a.rank === 1,
    );
    expect(mondayPrimaries.every((a) => a.apprenticeId === "d")).toBe(true);
    expect(mondayPrimaries.find((a) => a.slotId === BREAKFAST.id)?.existingId).toBe("fixed-1");
  });

  it("meldet einen Konflikt, wenn niemand verfügbar ist", () => {
    const result = generatePlan(
      baseInput({
        rangeStart: "2026-09-07",
        rangeEnd: "2026-09-07",
        apprentices: [apprentice("a", "Anna")],
        absences: [
          {
            apprenticeId: "a",
            type: "SICK",
            dayPart: "FULL",
            startDate: "2026-09-07",
            endDate: "2026-09-07",
          },
        ],
      }),
    );
    expect(result.stats.unfilledRanks).toBeGreaterThan(0);
    expect(result.issues.join(" ")).toContain("Keine Vertretung verfügbar");
  });

  it("ist deterministisch – gleicher Input, gleicher Plan", () => {
    const input = baseInput({ rangeStart: "2026-09-07", rangeEnd: "2026-09-25" });
    const a = generatePlan(input);
    const b = generatePlan(input);
    expect(a.assignments).toEqual(b.assignments);
  });

  it("respektiert den Ausbildungszeitraum", () => {
    const result = generatePlan(
      baseInput({
        apprentices: [
          apprentice("a", "Anna"),
          apprentice("b", "Ben"),
          apprentice("c", "Clara"),
          apprentice("neu", "Neuling", { startDate: "2026-09-10" }),
        ],
      }),
    );
    const early = result.days
      .filter((d) => d.date < "2026-09-10")
      .flatMap((d) => d.duties.flatMap((duty) => duty.assigned.map((a) => a.apprenticeId)));
    expect(early).not.toContain("neu");
  });
});
