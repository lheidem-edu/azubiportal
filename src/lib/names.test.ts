import { describe, expect, it } from "vitest";
import { compactName, firstName, fullName, initials, parseName } from "./names";

describe("Namen zerlegen", () => {
  it("versteht „Nachname, Vorname“", () => {
    expect(parseName("Heidemann, Luca")).toEqual({ given: "Luca", family: "Heidemann" });
  });

  it("versteht „Vorname Nachname“", () => {
    expect(parseName("Luca Heidemann")).toEqual({ given: "Luca", family: "Heidemann" });
  });

  it("kommt mit mehrteiligen Nachnamen zurecht", () => {
    expect(parseName("von der Heide, Anna")).toEqual({ given: "Anna", family: "von der Heide" });
    expect(parseName("Anna von der Heide")).toEqual({ given: "Anna", family: "von der Heide" });
  });

  it("kommt mit mehreren Vornamen zurecht", () => {
    expect(parseName("Krüger, David Maximilian")).toEqual({
      given: "David Maximilian",
      family: "Krüger",
    });
    expect(firstName("Krüger, David Maximilian")).toBe("David");
  });

  it("verträgt einzelne Namen und Leerraum", () => {
    expect(parseName("  Anna  ")).toEqual({ given: "Anna", family: "" });
    expect(parseName("")).toEqual({ given: "", family: "" });
    expect(firstName(null)).toBe("");
  });

  it("bildet aus einer E-Mail-Adresse einen Namen", () => {
    expect(parseName("luca.heidemann@firma.de")).toEqual({
      given: "Luca",
      family: "Heidemann",
    });
    expect(firstName("luca.heidemann@firma.de")).toBe("Luca");
  });

  it("räumt auch eine bloße Anmeldekennung auf", () => {
    // Der Entwicklungs-Login legt den Namen als „luca.heidemann“ ab.
    expect(parseName("luca.heidemann")).toEqual({ given: "Luca", family: "Heidemann" });
    expect(firstName("luca.heidemann")).toBe("Luca");
    expect(initials("luca.heidemann")).toBe("LH");
  });

  it("hält einen Punkt in einem echten Namen aus", () => {
    // Mit Leerzeichen ist es ein Name, keine Kennung.
    expect(parseName("Müller, Dr. Anna")).toEqual({ given: "Dr. Anna", family: "Müller" });
  });
});

describe("Anrede", () => {
  it("grüßt mit dem Vornamen, nicht mit dem Nachnamen", () => {
    // Genau hier lag der Fehler: „Hallo Heidemann,“
    expect(firstName("Heidemann, Luca")).toBe("Luca");
    expect(firstName("Luca Heidemann")).toBe("Luca");
  });

  it("hängt kein Komma an", () => {
    expect(firstName("Heidemann, Luca")).not.toContain(",");
  });
});

describe("Kürzel", () => {
  it("nimmt immer Vorname und Nachname in dieser Reihenfolge", () => {
    expect(initials("Heidemann, Luca")).toBe("LH");
    expect(initials("Luca Heidemann")).toBe("LH");
  });

  it("überspringt Namenszusätze", () => {
    expect(initials("von der Heide, Anna")).toBe("AH");
  });

  it("bleibt bei einzelnen Namen brauchbar", () => {
    expect(initials("Anna")).toBe("AN");
    expect(initials("")).toBe("?");
  });
});

describe("Kurzform", () => {
  it("zeigt den Vornamen", () => {
    expect(compactName("Heidemann, Luca")).toBe("Luca");
  });

  it("ergänzt auf Wunsch den Anfangsbuchstaben des Nachnamens", () => {
    expect(compactName("Heidemann, Luca", { withFamilyInitial: true })).toBe("Luca H.");
    expect(compactName("Anna", { withFamilyInitial: true })).toBe("Anna");
  });
});

describe("Anredeform", () => {
  it("dreht „Nachname, Vorname“ um", () => {
    expect(fullName("Heidemann, Luca")).toBe("Luca Heidemann");
    expect(fullName("Luca Heidemann")).toBe("Luca Heidemann");
  });
});
