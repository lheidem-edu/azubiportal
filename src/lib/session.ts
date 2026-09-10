import { redirect } from "next/navigation";
import { auth, canPlan, isAdmin, loadClaimsFor } from "@/lib/auth";
import { readViewAs } from "@/lib/impersonation";
import type { Role } from "@/db/schema";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
  apprenticeId: string | null;
  /** Personen der Zentrale, für die dieses Konto eintragen darf. */
  deskStaffIds: string[];
  notifyPlanning: boolean;
  /**
   * Gesetzt, wenn ein Administrator diese Person gerade ansieht. Dann
   * beschreiben alle Felder darüber die angesehene Person, nicht die
   * angemeldete – und Änderungen sind gesperrt.
   */
  viewedBy?: { id: string; name: string; email: string };
};

/** Das wirklich angemeldete Konto, ohne Rücksicht auf eine laufende Ansicht. */
export async function getRealSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image,
    role: session.user.role,
    apprenticeId: session.user.apprenticeId,
    deskStaffIds: session.user.deskStaffIds ?? [],
    notifyPlanning: session.user.notifyPlanning ?? true,
  };
}

/**
 * Die Person, aus deren Sicht die Anwendung gerade läuft.
 *
 * Normalerweise das angemeldete Konto. Sieht ein Administrator jemanden an,
 * ist es die angesehene Person – erkennbar an `viewedBy`. Der Tausch passiert
 * an dieser einen Stelle, damit jede Seite und jede Abfrage ohne eigenes
 * Zutun dasselbe sieht.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const real = await getRealSessionUser();
  if (!real) return null;

  // Nur Administratoren, und die Prüfung hängt an der wirklichen Rolle –
  // nicht an der angesehenen, sonst ließe sich die Ansicht weiterreichen.
  if (!isAdmin(real.role)) return real;

  const targetId = await readViewAs(real.id);
  if (!targetId) return real;

  const claims = await loadClaimsFor(targetId);
  // Gelöschtes oder gesperrtes Konto: zurück auf die eigene Identität.
  if (!claims.exists || !claims.isActive) return real;

  return {
    id: targetId,
    name: claims.name,
    email: claims.email,
    image: claims.image,
    role: claims.role,
    apprenticeId: claims.apprenticeId,
    deskStaffIds: claims.deskStaffIds,
    notifyPlanning: claims.notifyPlanning,
    viewedBy: { id: real.id, name: real.name, email: real.email },
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlanner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canPlan(user.role)) redirect("/");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/");
  return user;
}
