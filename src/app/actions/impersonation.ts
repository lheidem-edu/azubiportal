"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok, run, writeAudit } from "@/lib/action-utils";
import { isAdmin } from "@/lib/auth";
import { clearViewAs, readViewAs, setViewAs } from "@/lib/impersonation";
import { getRealSessionUser } from "@/lib/session";

/**
 * „Ansehen als" – für die Frage „bei mir sieht das anders aus".
 *
 * Bewusst eng gehalten: Nur Administratoren, nie ein anderes
 * Administratorkonto, keine Änderungen aus der Ansicht heraus, und Beginn wie
 * Ende stehen im Protokoll. Die Prüfungen hängen alle am wirklich angemeldeten
 * Konto, nicht am angesehenen – sonst ließe sich aus einer Ansicht die
 * nächste starten.
 */

async function requireRealAdmin() {
  const real = await getRealSessionUser();
  if (!real) throw new Error("Nicht angemeldet.");
  if (!isAdmin(real.role)) throw new Error("Dafür fehlt dir die Berechtigung.");
  return real;
}

export async function startViewAs(input: unknown) {
  return run(async () => {
    const targetId = z.string().uuid().parse(input);
    const real = await requireRealAdmin();

    if (targetId === real.id) return fail("Das ist dein eigenes Konto.");

    const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (!target) return fail("Benutzer nicht gefunden.");
    if (!target.isActive) return fail(`${target.name} hat keinen Zugang mehr.`);
    /*
     * Ein anderes Administratorkonto anzusehen brächte keine zusätzliche
     * Einsicht – beide dürfen ohnehin alles – wäre aber der einzige Fall, in
     * dem die Ansicht wie eine Rechteausweitung aussähe. Deshalb gar nicht
     * erst zulassen.
     */
    if (isAdmin(target.role)) return fail("Administratorkonten lassen sich nicht ansehen.");

    await setViewAs(real.id, targetId);
    await writeAudit(real, "impersonation.start", "user", targetId, {
      targetName: target.name,
      targetEmail: target.email,
    });

    revalidatePath("/", "layout");
    return ok(`Du siehst jetzt die Anwendung als ${target.name}.`);
  });
}

/**
 * Beendet die Ansicht. Läuft absichtlich nicht über `currentUser()`: Diese
 * Aktion muss gerade dann funktionieren, wenn die Schreibsperre greift.
 */
export async function stopViewAs() {
  return run(async () => {
    const real = await getRealSessionUser();
    if (!real) throw new Error("Nicht angemeldet.");

    // Vor dem Löschen lesen, damit im Protokoll steht, wen die Ansicht betraf.
    const targetId = await readViewAs(real.id);
    await clearViewAs();
    if (targetId) await writeAudit(real, "impersonation.stop", "user", targetId);

    revalidatePath("/", "layout");
    return ok("Ansicht beendet.");
  });
}
