/**
 * Aufbereitung der Zugangsdaten für Microsoft Entra ID.
 *
 * Der Provider von Auth.js greift nur dann auf seinen Standardwert zurück,
 * wenn `issuer` `undefined` ist. Eine leer gesetzte Umgebungsvariable
 * überschreibt ihn also mit einem leeren Text, und die Anmeldung scheitert
 * später mit einem nichtssagenden „Invalid URL". Deshalb werden die Werte
 * hier aufbereitet, bevor sie den Provider erreichen.
 */

/** Mandanten-ID (GUID) oder einer der von Microsoft vorgesehenen Sammelbegriffe. */
const TENANT_ONLY =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|common|organizations|consumers)$/i;

/** Leere oder nur aus Leerzeichen bestehende Werte gelten als nicht gesetzt. */
export function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  return value ? value : undefined;
}

export class EntraConfigError extends Error {}

/**
 * Vorgabe, wenn kein Mandant angegeben ist – dieselbe wie bei Auth.js.
 * Damit kann sich grundsätzlich jedes Microsoft-Konto anmelden; wer den Zugang
 * auf die eigene Organisation beschränken will, trägt die Mandanten-ID ein.
 */
export const DEFAULT_ENTRA_ISSUER = "https://login.microsoftonline.com/common/v2.0";

/**
 * Bringt die Angabe aus `AUTH_MICROSOFT_ENTRA_ID_ISSUER` in die Form, die
 * Auth.js erwartet. Akzeptiert werden:
 *
 *   - die vollständige Adresse  `https://login.microsoftonline.com/<id>/v2.0`
 *   - dieselbe ohne Schema      `login.microsoftonline.com/<id>/v2.0`
 *   - nur die Mandanten-ID      `72f988bf-86f1-41af-91ab-2d7cd011db47`
 *
 * Ohne Angabe gilt der Standard von Auth.js (`common`), mit dem sich jedes
 * Microsoft-Konto anmelden kann.
 */
export function normalizeEntraIssuer(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) return undefined;

  if (TENANT_ONLY.test(value)) {
    return `https://login.microsoftonline.com/${value}/v2.0`;
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new EntraConfigError(
      `AUTH_MICROSOFT_ENTRA_ID_ISSUER ist keine gültige Adresse: "${value}". ` +
        "Erwartet wird https://login.microsoftonline.com/<MANDANTEN-ID>/v2.0 oder nur die Mandanten-ID.",
    );
  }
  // Auth.js hängt „/.well-known/openid-configuration" an – ein abschließender
  // Schrägstrich würde zu einer doppelten Trennung führen.
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export type EntraConfig = {
  clientId: string;
  clientSecret: string;
  issuer: string;
};

/**
 * Bereitet die Umgebungsvariablen selbst auf, bevor Auth.js sie liest.
 *
 * Notwendig, weil `setEnvDefaults` in `@auth/core` den Aussteller so setzt:
 *
 *     finalProvider.issuer ?? (finalProvider.issuer = envObject[...])
 *
 * Der Entra-Provider hinterlegt seinen Wert aber nur in `options`, nicht am
 * Objekt selbst. Auth.js schreibt deshalb den **rohen** Umgebungswert darüber
 * und übergeht jede Aufbereitung, die wir dem Provider mitgeben. Ein leerer
 * Wert führt dann zu „InvalidEndpoints", eine bloße Mandanten-ID zu
 * „TypeError: Invalid URL". Beides lässt sich nur verhindern, indem die
 * Variable selbst in Ordnung gebracht wird.
 */
export function applyEntraEnvDefaults(
  env: Record<string, string | undefined> = process.env,
): void {
  for (const name of ["AUTH_MICROSOFT_ENTRA_ID_ID", "AUTH_MICROSOFT_ENTRA_ID_SECRET"]) {
    const value = env[name]?.trim().replace(/^["']|["']$/g, "");
    if (value) env[name] = value;
    else delete env[name];
  }

  const issuer = normalizeEntraIssuer(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER);
  if (issuer) env.AUTH_MICROSOFT_ENTRA_ID_ISSUER = issuer;
  else delete env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
}

/** Liefert die Konfiguration, oder `null`, wenn Entra ID nicht eingerichtet ist. */
export function readEntraConfig(): EntraConfig | null {
  const clientId = envValue("AUTH_MICROSOFT_ENTRA_ID_ID");
  if (!clientId) return null;

  const clientSecret = envValue("AUTH_MICROSOFT_ENTRA_ID_SECRET");
  if (!clientSecret) {
    throw new EntraConfigError(
      "AUTH_MICROSOFT_ENTRA_ID_SECRET fehlt. Ohne Geheimnis kann die Anmeldung über Microsoft nicht funktionieren.",
    );
  }

  return {
    clientId,
    clientSecret,
    /**
     * Immer ausdrücklich gesetzt: Der Provider würde bei fehlender Angabe
     * selbst in die Umgebung schauen, was im Standalone-Build nicht
     * zuverlässig funktioniert. So ist die Herkunft des Wertes eindeutig.
     */
    issuer: normalizeEntraIssuer(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) ?? DEFAULT_ENTRA_ISSUER,
  };
}
