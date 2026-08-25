/**
 * Wer darf sich überhaupt anmelden.
 *
 * Auch bei richtig eingerichtetem Entra ID kann die Anmeldung mehr Konten
 * zulassen als gewollt – etwa wenn die App-Registrierung mandantenübergreifend
 * ist. Weil beim ersten erfolgreichen Login automatisch ein Benutzerkonto
 * entsteht, gibt es hier eine zusätzliche Schranke über die E-Mail-Domäne.
 *
 * Die Liste steht bewusst in der Umgebung und nicht in den Einstellungen:
 * Sie soll sich nicht aus der Anwendung heraus aufweichen lassen.
 */

/** Domänen aus `ALLOWED_EMAIL_DOMAINS`, mit oder ohne führendes „@". */
export function allowedEmailDomains(
  value = process.env.ALLOWED_EMAIL_DOMAINS,
): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * Prüft eine Adresse gegen die Liste. Ist keine Domäne hinterlegt, wird nicht
 * eingeschränkt – dann entscheidet allein die Anmeldung bei Microsoft.
 */
export function isEmailAllowed(
  email: string,
  domains = allowedEmailDomains(),
): boolean {
  if (domains.length === 0) return true;

  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();

  // Ein Eintrag deckt die Domäne selbst und ihre Unterdomänen ab.
  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}
