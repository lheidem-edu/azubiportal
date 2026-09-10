import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-fuer-die-signatur";

let sign: (realUserId: string, targetUserId: string) => string;
let signatureMatches: (candidate: string, expected: string) => boolean;

beforeAll(async () => {
  ({
    __testing: { sign, signatureMatches },
  } = await import("./impersonation"));
});

const ADMIN = "11111111-1111-4111-8111-111111111111";
const ANDERER_ADMIN = "22222222-2222-4222-8222-222222222222";
const AZUBI = "33333333-3333-4333-8333-333333333333";

describe("Signatur der Ansicht", () => {
  it("erkennt die eigene Signatur wieder", () => {
    expect(signatureMatches(sign(ADMIN, AZUBI), sign(ADMIN, AZUBI))).toBe(true);
  });

  it("bindet die Signatur an das angemeldete Konto", () => {
    /*
     * Der Kern der Absicherung: Ein abgefangenes Cookie nützt in einer
     * fremden Sitzung nichts, weil die Kennung des Ansehenden mit
     * unterschrieben ist.
     */
    expect(signatureMatches(sign(ADMIN, AZUBI), sign(ANDERER_ADMIN, AZUBI))).toBe(false);
  });

  it("bindet die Signatur an die angesehene Person", () => {
    expect(signatureMatches(sign(ADMIN, AZUBI), sign(ADMIN, ANDERER_ADMIN))).toBe(false);
  });

  it("weist eine Signatur abweichender Länge ab, ohne zu werfen", () => {
    // timingSafeEqual wirft bei ungleicher Länge – der Vergleich fängt das ab.
    expect(signatureMatches("zu-kurz", sign(ADMIN, AZUBI))).toBe(false);
    expect(signatureMatches("", sign(ADMIN, AZUBI))).toBe(false);
  });

  it("erzeugt keine Signatur, die zufällig zu erraten wäre", () => {
    const signature = sign(ADMIN, AZUBI);
    expect(signature.length).toBeGreaterThanOrEqual(43);
    expect(signature).not.toContain(AZUBI);
  });
});
