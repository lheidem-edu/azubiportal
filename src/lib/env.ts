/**
 * Prüft beim Start des Containers, ob alles Nötige gesetzt ist. Ein Fehler
 * hier ist besser als eine Anwendung, die scheinbar läuft und beim ersten
 * Login abstürzt.
 */

import { envValue, normalizeEntraIssuer } from "@/lib/entra";
import { allowedEmailDomains } from "@/lib/access";

type Check = { name: string; ok: boolean; hint: string };

/** Prüft, ob ein Wert eine vollständige Adresse ist. */
function isUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function issuerIsUsable(): boolean {
  try {
    normalizeEntraIssuer(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER);
    return true;
  } catch {
    return false;
  }
}

export function checkEnvironment(): Check[] {
  const production = process.env.NODE_ENV === "production";
  const entraConfigured = Boolean(envValue("AUTH_MICROSOFT_ENTRA_ID_ID"));
  const devLogin = process.env.DEV_LOGIN_ENABLED === "true";

  return [
    {
      name: "DATABASE_URL",
      ok: Boolean(process.env.DATABASE_URL),
      hint: "Verbindungszeichenfolge zur PostgreSQL-Datenbank.",
    },
    {
      name: "AUTH_SECRET",
      ok: (process.env.AUTH_SECRET ?? "").length >= 32,
      hint: "Mindestens 32 Zeichen, z.B. aus `openssl rand -base64 32`.",
    },
    {
      name: "AUTH_URL",
      ok: !production || isUrl(envValue("AUTH_URL")),
      hint: "Vollständige öffentliche Adresse der Anwendung, z.B. https://azubiportal.firma.de",
    },
    {
      name: "CRON_SECRET",
      ok: !production || (process.env.CRON_SECRET ?? "").length >= 16,
      hint: "Schützt den Endpunkt für Erinnerungen und Planläufe.",
    },
    {
      name: "Anmeldeverfahren",
      ok: entraConfigured || !production,
      hint: "In Produktion muss Microsoft Entra ID konfiguriert sein (AUTH_MICROSOFT_ENTRA_ID_*).",
    },
    {
      name: "AUTH_MICROSOFT_ENTRA_ID_SECRET",
      ok: !entraConfigured || Boolean(envValue("AUTH_MICROSOFT_ENTRA_ID_SECRET")),
      hint: "Wird zusammen mit AUTH_MICROSOFT_ENTRA_ID_ID benötigt (Wert des Client-Geheimnisses, nicht dessen ID).",
    },
    {
      name: "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
      ok: !entraConfigured || issuerIsUsable(),
      hint: "Entweder leer lassen oder https://login.microsoftonline.com/<MANDANTEN-ID>/v2.0 bzw. nur die Mandanten-ID angeben.",
    },
    {
      name: "ALLOWED_EMAIL_DOMAINS",
      // Eine leere Liste ist zulässig, ein unbrauchbarer Eintrag nicht.
      ok:
        !process.env.ALLOWED_EMAIL_DOMAINS?.trim() ||
        allowedEmailDomains().every((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)),
      hint: "Kommagetrennte Liste von E-Mail-Domänen, z.B. firma.de – oder leer lassen.",
    },
    {
      name: "DEV_LOGIN_ENABLED",
      ok: !(production && devLogin),
      hint: "Der Entwicklungs-Login darf in Produktion nicht aktiv sein.",
    },
  ];
}

/** Bricht ab, wenn eine Voraussetzung fehlt. Für den Container-Start gedacht. */
export function assertEnvironment() {
  const failed = checkEnvironment().filter((c) => !c.ok);
  if (failed.length === 0) return;
  console.error("\nDie Konfiguration ist unvollständig:\n");
  for (const check of failed) console.error(`  ✗ ${check.name} – ${check.hint}`);
  console.error("");
  throw new Error(`${failed.length} fehlende oder unzulässige Einstellung(en).`);
}
