import { describe, expect, it } from "vitest";
import { allowedEmailDomains, isEmailAllowed } from "./access";

describe("Erlaubte E-Mail-Domänen", () => {
  it("liest die Liste mit und ohne führendes @", () => {
    expect(allowedEmailDomains("firma.de, @beispiel.com ,")).toEqual([
      "firma.de",
      "beispiel.com",
    ]);
  });

  it("lässt ohne hinterlegte Liste alles zu", () => {
    expect(isEmailAllowed("wer@auch-immer.de", [])).toBe(true);
  });

  it("lässt nur die eingetragenen Domänen zu", () => {
    const domains = ["firma.de"];
    expect(isEmailAllowed("vorname.nachname@firma.de", domains)).toBe(true);
    expect(isEmailAllowed("Vorname.Nachname@FIRMA.DE", domains)).toBe(true);
    expect(isEmailAllowed("fremd@andere.de", domains)).toBe(false);
  });

  it("deckt Unterdomänen mit ab", () => {
    expect(isEmailAllowed("azubi@mail.firma.de", ["firma.de"])).toBe(true);
    // Keine Übereinstimmung, nur weil die Zeichenkette endet wie erlaubt
    expect(isEmailAllowed("angriff@boesefirma.de", ["firma.de"])).toBe(false);
  });

  it("weist unbrauchbare Adressen ab", () => {
    const domains = ["firma.de"];
    expect(isEmailAllowed("ohne-at-zeichen", domains)).toBe(false);
    expect(isEmailAllowed("@firma.de", domains)).toBe(false);
    expect(isEmailAllowed("leer@", domains)).toBe(false);
  });
});
