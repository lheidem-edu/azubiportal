import { redirect } from "next/navigation";
import { auth, canPlan, isAdmin } from "@/lib/auth";
import type { Role } from "@/db/schema";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
  apprenticeId: string | null;
  deskStaffId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image,
    role: session.user.role,
    apprenticeId: session.user.apprenticeId,
    deskStaffId: session.user.deskStaffId,
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
