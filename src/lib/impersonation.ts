import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * „Ansehen als" – ein Administrator sieht die Anwendung mit den Augen einer
 * anderen Person.
 *
 * Die übernommene Identität liegt in einem eigenen Cookie, nicht im
 * Sitzungstoken. Dadurch bleibt die wirkliche Anmeldung unangetastet: Wer
 * gerade ansieht, ist jederzeit bekannt, das Beenden kann nichts kaputt
 * machen, und ein abgelaufenes Cookie fällt einfach auf die eigene Identität
 * zurück.
 *
 * Die Signatur bindet das Cookie an beide Beteiligten. Ein abgefangenes
 * Cookie nützt in einer fremden Sitzung nichts, weil die Kennung des wirklich
 * angemeldeten Kontos mit unterschrieben ist.
 */

const COOKIE = "azubiportal.view-as";

/** Nach dieser Zeit endet die Ansicht von selbst. */
const MAX_AGE_SECONDS = 60 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET fehlt – die Ansicht lässt sich nicht absichern.");
  return value;
}

function sign(realUserId: string, targetUserId: string): string {
  return createHmac("sha256", secret())
    .update(`${realUserId}:${targetUserId}`)
    .digest("base64url");
}

function signatureMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Wen sieht dieses Konto gerade an? `null`, wenn nichts gesetzt ist oder die
 * Signatur nicht zum angemeldeten Konto passt.
 */
export async function readViewAs(realUserId: string): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const targetUserId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  if (!signatureMatches(signature, sign(realUserId, targetUserId))) return null;
  // Sich selbst anzusehen ist keine Ansicht, sondern der Normalfall.
  if (targetUserId === realUserId) return null;
  return targetUserId;
}

export async function setViewAs(realUserId: string, targetUserId: string) {
  (await cookies()).set(COOKIE, `${targetUserId}.${sign(realUserId, targetUserId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearViewAs() {
  (await cookies()).delete(COOKIE);
}

/* Nur für Tests: die Signatur ohne Cookie-Zugriff prüfbar machen. */
export const __testing = { sign, signatureMatches, COOKIE, MAX_AGE_SECONDS };
