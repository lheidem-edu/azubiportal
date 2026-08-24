"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSetting, SETTINGS_SCHEMAS, setSetting, type SettingsKey } from "@/lib/settings";
import {
  fail,
  ok,
  requireAdminAction,
  requirePlannerAction,
  run,
  writeAudit,
} from "@/lib/action-utils";
import { dispatchDailyReminders, sendMail, sendTeamsCard, verifySmtp } from "@/lib/notify";
import { today } from "@/lib/dates";
import { APP_NAME } from "@/lib/app-config";

export async function saveSettings(key: SettingsKey, value: unknown) {
  return run(async () => {
    const user = await requireAdminAction();
    if (!(key in SETTINGS_SCHEMAS)) return fail("Unbekannter Einstellungsbereich.");
    const parsed = SETTINGS_SCHEMAS[key].parse(value);
    await setSetting(key, parsed as never, user.id);
    await writeAudit(user, "settings.update", "settings", key, redact(key, parsed));
    revalidatePath("/admin/settings");
    revalidatePath("/admin/notifications");
    return ok("Einstellungen gespeichert.");
  });
}

/** Passwörter gehören nicht ins Protokoll. */
function redact(key: SettingsKey, value: unknown) {
  if (key !== "smtp") return value;
  return { ...(value as Record<string, unknown>), password: "***" };
}

export async function testSmtpAction(recipient: string) {
  return run(async () => {
    await requireAdminAction();
    if (!z.email().safeParse(recipient).success) {
      return fail("Bitte eine gültige E-Mail-Adresse angeben.");
    }
    const check = await verifySmtp();
    if (!check.ok) return fail(`Verbindung fehlgeschlagen: ${check.error}`);

    const result = await sendMail({
      to: recipient,
      subject: `Testnachricht aus ${APP_NAME}`,
      text: `Die E-Mail-Einstellungen funktionieren. Diese Nachricht wurde von ${APP_NAME} als Test versendet.`,
    });
    return result.ok ? ok(`Testnachricht an ${recipient} versendet.`) : fail(result.error);
  });
}

export async function testTeamsAction() {
  return run(async () => {
    await requireAdminAction();
    const teams = await getSetting("teams");
    if (!teams.defaultWebhookUrl) return fail("Es ist kein Webhook hinterlegt.");
    const result = await sendTeamsCard(teams.defaultWebhookUrl, {
      title: `Testnachricht aus ${APP_NAME}`,
      subtitle: "Die Teams-Anbindung funktioniert.",
      facts: [{ name: "Status", value: "Verbindung erfolgreich" }],
    });
    return result.ok ? ok("Testkarte an Teams gesendet.") : fail(result.error);
  });
}

/** Stößt den Versand der heutigen Erinnerungen von Hand an. */
export async function sendRemindersNowAction(force = false) {
  return run(async () => {
    const user = await requirePlannerAction();
    const result = await dispatchDailyReminders(today(), { force });
    await writeAudit(user, "reminders.manual", "notification", undefined, result);
    revalidatePath("/admin/notifications");
    if (result.sent === 0 && result.failed === 0) {
      return ok("Es gab heute nichts zu versenden (oder alles war bereits verschickt).");
    }
    return ok(
      `${result.sent} Nachricht(en) versendet, ${result.skipped} übersprungen, ${result.failed} fehlgeschlagen.`,
      result,
    );
  });
}
