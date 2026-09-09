import { describe, expect, it } from "vitest";
import { actingRankOf, blocksSlot } from "./standin";

describe("Wer übernimmt den Dienst", () => {
  it("ist im Normalfall die eingeteilte Vertretung", () => {
    expect(actingRankOf([1, 2, 3])).toBe(1);
  });

  it("ist der 1. Ersatz, wenn die Vertretung ausfällt", () => {
    // Rang 1 fehlt in der Liste, weil die Person ausgefallen ist.
    expect(actingRankOf([2, 3])).toBe(2);
  });

  it("ist der 2. Ersatz, wenn auch der erste ausfällt", () => {
    expect(actingRankOf([3])).toBe(3);
  });

  it("ist niemand, wenn alle ausfallen", () => {
    expect(actingRankOf([])).toBeNull();
  });
});

describe("Welche Slots eine Abwesenheit trifft", () => {
  it("ganze Tage treffen alles", () => {
    expect(blocksSlot("FULL", "09:00:00")).toBe(true);
    expect(blocksSlot("FULL", "13:00:00")).toBe(true);
  });

  it("ein freier Vormittag trifft nur die Vormittagsslots", () => {
    expect(blocksSlot("MORNING", "09:00:00")).toBe(true);
    expect(blocksSlot("MORNING", "12:00:00")).toBe(false);
  });

  it("ein freier Nachmittag trifft nur die Nachmittagsslots", () => {
    expect(blocksSlot("AFTERNOON", "09:00:00")).toBe(false);
    expect(blocksSlot("AFTERNOON", "12:00:00")).toBe(true);
  });
});
