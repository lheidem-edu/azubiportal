import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { canPlan, isAdmin } from "@/lib/auth";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function ok<T>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

/**
 * Beim Ansehen einer anderen Person ist die Anwendung schreibgeschützt.
 *
 * Ein Administrator darf ohnehin alles – nur eben unter seinem eigenen Namen.
 * Ein Eintrag, der aus einer Ansicht heraus entsteht, trüge dagegen den Namen
 * der angesehenen Person: Eine Krankmeldung sähe aus, als hätte sie jemand
 * selbst gemeldet. Diese Verwechslung ist der einzige Zugewinn, den Schreiben
 * in fremder Ansicht hätte, und genau deshalb ist es gesperrt.
 *
 * Lesende Aktionen geben `readOnly` mit und dürfen weiterlaufen.
 */
export type ActionOptions = { readOnly?: boolean };

function assertMayWrite(user: SessionUser, options: ActionOptions) {
  if (!user.viewedBy || options.readOnly) return;
  throw new Error(
    `Du siehst gerade ${user.name} an – in dieser Ansicht sind keine Änderungen möglich. Beende sie oben in der Leiste.`,
  );
}

/** Wirft, wenn niemand angemeldet ist. In Server-Actions immer zuerst aufrufen. */
export async function currentUser(options: ActionOptions = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Nicht angemeldet.");
  assertMayWrite(user, options);
  return user;
}

export async function requirePlannerAction(options: ActionOptions = {}): Promise<SessionUser> {
  const user = await currentUser(options);
  if (!canPlan(user.role)) throw new Error("Dafür fehlt dir die Berechtigung.");
  return user;
}

export async function requireAdminAction(options: ActionOptions = {}): Promise<SessionUser> {
  const user = await currentUser(options);
  if (!isAdmin(user.role)) throw new Error("Dafür fehlt dir die Berechtigung.");
  return user;
}

/**
 * Prüft, ob der Benutzer die Daten des angegebenen Azubis bearbeiten darf:
 * entweder die eigenen oder – als Planungsverantwortlicher – alle.
 */
export async function assertCanEditApprentice(apprenticeId: string): Promise<SessionUser> {
  const user = await currentUser();
  if (canPlan(user.role)) return user;
  if (user.apprenticeId === apprenticeId) return user;
  throw new Error("Du darfst nur deine eigenen Daten bearbeiten.");
}

export async function writeAudit(
  actor: SessionUser | null,
  action: string,
  entity: string,
  entityId?: string,
  payload?: unknown,
) {
  await db.insert(auditLog).values({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    payload: (payload ?? null) as never,
  });
}

/** Wandelt einen Zod-Fehler in ein Ergebnis für das Formular um. */
export function fromZod(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const fieldErrors = flat.fieldErrors as Record<string, string[]>;
  const first = Object.values(fieldErrors).flat()[0] ?? flat.formErrors[0];
  return fail(first ?? "Die Eingaben sind unvollständig.", fieldErrors);
}

/** Einheitliche Fehlerbehandlung für Server-Actions. */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof z.ZodError) return fromZod(error);
    const message = error instanceof Error ? error.message : "Unerwarteter Fehler.";
    console.error("[action]", error);
    return fail(message);
  }
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum angeben.");
