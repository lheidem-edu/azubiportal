import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { apprentices, deskStaff, users, type Role } from "@/db/schema";
import { randomBytes } from "node:crypto";
import { applyEntraEnvDefaults, readEntraConfig } from "@/lib/entra";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Gesetzt, wenn das Konto zu einem Auszubildenden gehört. */
      apprenticeId: string | null;
      /** Gesetzt, wenn das Konto zur festen Zentrale-Besetzung gehört. */
      deskStaffId: string | null;
    } & DefaultSession["user"];
  }
}

const devLoginEnabled =
  process.env.DEV_LOGIN_ENABLED === "true" && process.env.NODE_ENV !== "production";

/**
 * Auth.js liest `AUTH_URL` selbst aus der Umgebung. Steht dort ein leerer Wert
 * – etwa weil Docker Compose eine nicht gesetzte Variable eingesetzt hat –,
 * versucht es daraus eine Adresse zu bauen und scheitert. Ein leerer Wert ist
 * dasselbe wie kein Wert.
 */
for (const name of ["AUTH_URL", "NEXTAUTH_URL", "AUTH_REDIRECT_PROXY_URL"]) {
  if (process.env[name] !== undefined && process.env[name]!.trim() === "") {
    delete process.env[name];
  }
}

// Muss vor `NextAuth()` laufen: Auth.js liest diese Variablen selbst aus.
applyEntraEnvDefaults();
const entra = readEntraConfig();

function bootstrapAdmins(): string[] {
  return (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Legt den Benutzer beim ersten Login an bzw. aktualisiert ihn.
 * Die Rollenvergabe passiert danach in der Verwaltung; nur die in
 * BOOTSTRAP_ADMIN_EMAILS hinterlegten Adressen bekommen automatisch ADMIN.
 */
async function upsertUser(input: {
  email: string;
  name: string;
  entraOid?: string | null;
  image?: string | null;
}) {
  const email = input.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    if (!existing.isActive) return null;
    await db
      .update(users)
      .set({
        name: input.name || existing.name,
        entraOid: input.entraOid ?? existing.entraOid,
        image: input.image ?? existing.image,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    await linkPersonByEmail(existing.id, email);
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name || email,
      entraOid: input.entraOid ?? null,
      image: input.image ?? null,
      role: await initialRoleFor(email),
      lastLoginAt: new Date(),
    })
    .returning();

  await linkPersonByEmail(created.id, email);
  return created;
}

/**
 * Rolle beim allerersten Login. Wer schon als Zentrale-Besetzung hinterlegt
 * ist, bekommt die Rolle DESK und darf damit nur eigene Abwesenheiten pflegen.
 */
async function initialRoleFor(email: string): Promise<Role> {
  if (bootstrapAdmins().includes(email)) return "ADMIN";
  const staff = await db.query.deskStaff.findFirst({
    where: sql`lower(${deskStaff.email}) = ${email}`,
  });
  return staff ? "DESK" : "APPRENTICE";
}

/**
 * Verknüpft einen frisch angemeldeten Benutzer mit einem bereits angelegten
 * Personendatensatz gleicher E-Mail-Adresse – als Auszubildende:r oder als
 * Zentrale-Besetzung. Dadurch können beide vorab gepflegt werden, bevor sich
 * die Person erstmals anmeldet.
 */
async function linkPersonByEmail(userId: string, email: string) {
  await db
    .update(apprentices)
    .set({ userId, updatedAt: new Date() })
    .where(sql`lower(${apprentices.email}) = ${email} and ${apprentices.userId} is null`);
  await db
    .update(deskStaff)
    .set({ userId, updatedAt: new Date() })
    .where(sql`lower(${deskStaff.email}) = ${email} and ${deskStaff.userId} is null`);
}

async function loadClaims(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      apprentice: { columns: { id: true } },
      deskStaff: { columns: { id: true } },
    },
  });
  return {
    role: (user?.role ?? "APPRENTICE") as Role,
    apprenticeId: user?.apprentice?.id ?? null,
    deskStaffId: user?.deskStaff?.id ?? null,
    isActive: user?.isActive ?? false,
    name: user?.name ?? "",
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [
    ...(entra
      ? [
          MicrosoftEntraID({
            clientId: entra.clientId,
            clientSecret: entra.clientSecret,
            issuer: entra.issuer,
            authorization: { params: { scope: "openid profile email User.Read" } },
          }),
        ]
      : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Entwicklungs-Login",
            credentials: { email: { label: "E-Mail", type: "email" } },
            authorize: async (credentials) => {
              const email = String(credentials?.email ?? "").toLowerCase();
              if (!email.includes("@")) return null;
              const user = await upsertUser({ email, name: email.split("@")[0] });
              if (!user) return null;
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "dev") return true;
      const email = (user.email ?? (profile?.email as string) ?? "").toLowerCase();
      if (!email) return false;
      const record = await upsertUser({
        email,
        name: user.name ?? (profile?.name as string) ?? email,
        entraOid: (profile?.oid as string) ?? null,
        image: user.image ?? null,
      });
      if (!record) return false;
      user.id = record.id;
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.id) token.userId = user.id;
      else if (!token.userId && token.email) {
        const found = await db.query.users.findFirst({
          where: eq(users.email, String(token.email).toLowerCase()),
          columns: { id: true },
        });
        token.userId = found?.id;
      }
      // Rolle und Azubi-Verknüpfung bei jedem Login bzw. Session-Update neu laden
      if (token.userId && (user || trigger === "update" || token.role === undefined)) {
        const claims = await loadClaims(String(token.userId));
        token.role = claims.role;
        token.apprenticeId = claims.apprenticeId;
        token.deskStaffId = claims.deskStaffId;
        token.name = claims.name || token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = String(token.userId);
      session.user.role = (token.role as Role) ?? "APPRENTICE";
      session.user.apprenticeId = (token.apprenticeId as string | null) ?? null;
      session.user.deskStaffId = (token.deskStaffId as string | null) ?? null;
      return session;
    },
  },
});

export function newIcsToken() {
  return randomBytes(24).toString("base64url");
}

/* -------------------------------------------------------------------------- */
/* Berechtigungen                                                             */
/* -------------------------------------------------------------------------- */

export { canPlan, isAdmin, ROLE_LABELS } from "@/lib/labels";
