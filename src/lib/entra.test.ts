import { afterEach, describe, expect, it } from "vitest";
import {
  applyEntraEnvDefaults,
  DEFAULT_ENTRA_ISSUER,
  EntraConfigError,
  normalizeEntraIssuer,
  readEntraConfig,
} from "./entra";

describe("Entra-ID-Aussteller", () => {
  it("übernimmt eine vollständige Adresse unverändert", () => {
    expect(normalizeEntraIssuer("https://login.microsoftonline.com/abc/v2.0")).toBe(
      "https://login.microsoftonline.com/abc/v2.0",
    );
  });

  it("entfernt einen abschließenden Schrägstrich", () => {
    // Die Anleitung von Microsoft zeigt die Adresse mit Schrägstrich; Auth.js
    // hängt den Discovery-Pfad an und käme sonst auf eine doppelte Trennung.
    expect(normalizeEntraIssuer("https://login.microsoftonline.com/abc/v2.0/")).toBe(
      "https://login.microsoftonline.com/abc/v2.0",
    );
  });

  it("baut aus einer reinen Mandanten-ID die vollständige Adresse", () => {
    expect(normalizeEntraIssuer("72f988bf-86f1-41af-91ab-2d7cd011db47")).toBe(
      "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0",
    );
    expect(normalizeEntraIssuer("common")).toBe(
      "https://login.microsoftonline.com/common/v2.0",
    );
  });

  it("ergänzt ein fehlendes Schema", () => {
    expect(normalizeEntraIssuer("login.microsoftonline.com/abc/v2.0")).toBe(
      "https://login.microsoftonline.com/abc/v2.0",
    );
  });

  it("entfernt versehentlich mitkopierte Anführungszeichen und Leerzeichen", () => {
    expect(normalizeEntraIssuer('  "https://login.microsoftonline.com/abc/v2.0"  ')).toBe(
      "https://login.microsoftonline.com/abc/v2.0",
    );
  });

  it("behandelt einen leeren Wert wie nicht gesetzt", () => {
    // Genau hier lag der Fehler: Ein leerer Text überschrieb den Standardwert
    // des Providers und führte zu „TypeError: Invalid URL".
    expect(normalizeEntraIssuer("")).toBeUndefined();
    expect(normalizeEntraIssuer("   ")).toBeUndefined();
    expect(normalizeEntraIssuer(undefined)).toBeUndefined();
  });

  it("meldet eine unbrauchbare Angabe verständlich", () => {
    expect(() => normalizeEntraIssuer("nicht :// gültig")).toThrow(EntraConfigError);
    expect(() => normalizeEntraIssuer("nicht :// gültig")).toThrow(
      /AUTH_MICROSOFT_ENTRA_ID_ISSUER/,
    );
  });
});

describe("Entra-ID-Konfiguration", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("ist nicht eingerichtet, wenn keine Anwendungs-ID gesetzt ist", () => {
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
    expect(readEntraConfig()).toBeNull();
  });

  it("behandelt eine leer gesetzte Anwendungs-ID wie nicht eingerichtet", () => {
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "   ";
    expect(readEntraConfig()).toBeNull();
  });

  it("setzt bei fehlendem Mandanten den Standard-Aussteller", () => {
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER = "";
    expect(readEntraConfig()?.issuer).toBe(DEFAULT_ENTRA_ISSUER);
  });

  it("verlangt das Geheimnis, wenn eine Anwendungs-ID gesetzt ist", () => {
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client";
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
    expect(() => readEntraConfig()).toThrow(EntraConfigError);
  });
});

describe("Umgebungsvariablen für Auth.js aufbereiten", () => {
  /**
   * Auth.js schreibt den rohen Umgebungswert über die Provider-Konfiguration.
   * Diese Fälle bilden genau die Fehler nach, die in der Produktion auftraten.
   */
  it("macht aus einer bloßen Mandanten-ID eine vollständige Adresse", () => {
    const env = { AUTH_MICROSOFT_ENTRA_ID_ISSUER: "72f988bf-86f1-41af-91ab-2d7cd011db47" };
    applyEntraEnvDefaults(env);
    expect(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER).toBe(
      "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0",
    );
  });

  it("entfernt eine leer gesetzte Variable, statt sie leer stehen zu lassen", () => {
    const env: Record<string, string | undefined> = {
      AUTH_MICROSOFT_ENTRA_ID_ID: "client",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "  ",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: "",
    };
    applyEntraEnvDefaults(env);
    expect("AUTH_MICROSOFT_ENTRA_ID_ISSUER" in env).toBe(false);
    expect("AUTH_MICROSOFT_ENTRA_ID_SECRET" in env).toBe(false);
    expect(env.AUTH_MICROSOFT_ENTRA_ID_ID).toBe("client");
  });

  it("räumt Leerzeichen und Anführungszeichen weg", () => {
    const env = { AUTH_MICROSOFT_ENTRA_ID_ID: ' "client-id" ' };
    applyEntraEnvDefaults(env);
    expect(env.AUTH_MICROSOFT_ENTRA_ID_ID).toBe("client-id");
  });
});
