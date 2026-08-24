import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coverageSlots, users } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/session";
import { getAllSettings } from "@/lib/settings";
import {
  GeneralSettingsForm,
  PlanningSettingsForm,
  ReminderSettingsForm,
  SmtpSettingsForm,
  TeamsSettingsForm,
} from "./settings-forms";
import { UserRoles, type UserRow } from "./user-roles";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const [settings, accounts, breakSlots] = await Promise.all([
    getAllSettings(),
    db.select().from(users).orderBy(asc(users.name)),
    db
      .select({ label: coverageSlots.label })
      .from(coverageSlots)
      .where(and(eq(coverageSlots.kind, "BREAK"), eq(coverageSlots.isActive, true)))
      .orderBy(asc(coverageSlots.sortOrder)),
  ]);

  const rows: UserRow[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    isActive: account.isActive,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    isSelf: account.id === me.id,
  }));

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Planungsverhalten, Benachrichtigungswege und Berechtigungen."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <GeneralSettingsForm initial={settings.general} />
        <PlanningSettingsForm
          initial={settings.planning}
          breakSlotLabels={breakSlots.map((s) => s.label)}
        />
        <ReminderSettingsForm initial={settings.reminders} />
        <TeamsSettingsForm initial={settings.teams} />
        <div className="lg:col-span-2">
          <SmtpSettingsForm initial={settings.smtp} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Benutzer & Rollen</CardTitle>
          <CardDescription>
            Konten entstehen automatisch beim ersten Login über Microsoft Entra ID.
            Planungsverantwortliche dürfen Pläne erzeugen und Stammdaten pflegen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserRoles rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}
