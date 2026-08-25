import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * Alle konfigurierbaren Einstellungen liegen als JSON in der Tabelle
 * `settings`. Jeder Bereich hat ein Zod-Schema mit Standardwerten – dadurch
 * funktioniert die Anwendung auch mit leerer Tabelle und neue Felder bekommen
 * automatisch sinnvolle Vorgaben.
 */

export const generalSettingsSchema = z.object({
  companyName: z.string().default("Zentrale"),
  region: z.string().default("NRW"),
  /**
   * Wie viele Arbeitswochen die Automatik im Voraus plant, gerechnet ab der
   * kommenden Woche.
   */
  planningWeeks: z.number().int().min(1).max(26).default(2),
  /** Wie viele Tage in die Vergangenheit für den Lastenausgleich zählen. */
  fairnessWindowDays: z.number().int().min(0).max(730).default(180),
});

export const planningSettingsSchema = z.object({
  minGapDays: z.number().int().min(0).max(14).default(1),
  maxPerWeek: z.number().int().min(1).max(10).default(3),
  backupWeight: z.number().min(0).max(1).default(0.15),
  /**
   * Alle Pausen eines Tages übernimmt dieselbe Person. Nur ausschalten, wenn
   * Frühstücks- und Mittagspause getrennt besetzt werden sollen.
   */
  combineBreaks: z.boolean().default(true),
  combinedBreakLabel: z.string().min(2).max(60).default("Pausenvertretung"),
  /** Automatischer Planlauf per Cron. */
  autoPlanEnabled: z.boolean().default(true),
});

export const reminderSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Uhrzeit der Morgenerinnerung, HH:MM. */
  sendAt: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  /** Auch die Ersatzleute informieren. */
  notifyBackups: z.boolean().default(true),
  /** Zusätzlich am Vorabend erinnern. */
  notifyDayBefore: z.boolean().default(false),
});

export const smtpSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default(""),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().default(""),
  password: z.string().default(""),
  from: z.string().default("zentrale@example.com"),
  replyTo: z.string().default(""),
});

export const teamsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Webhook eines Teams-Kanals bzw. Power-Automate-Workflows. */
  defaultWebhookUrl: z.string().default(""),
  /** Zusätzlich eine Tagesübersicht in den Kanal posten. */
  postDailyOverview: z.boolean().default(false),
});

export const SETTINGS_SCHEMAS = {
  general: generalSettingsSchema,
  planning: planningSettingsSchema,
  reminders: reminderSettingsSchema,
  smtp: smtpSettingsSchema,
  teams: teamsSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export function defaultsFor<K extends SettingsKey>(key: K): SettingsValue<K> {
  return SETTINGS_SCHEMAS[key].parse({}) as SettingsValue<K>;
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const parsed = SETTINGS_SCHEMAS[key].safeParse(row?.value ?? {});
  return (parsed.success ? parsed.data : defaultsFor(key)) as SettingsValue<K>;
}

export async function getAllSettings() {
  const rows = await db.select().from(settings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as { [K in SettingsKey]: SettingsValue<K> };
  for (const key of Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]) {
    const parsed = SETTINGS_SCHEMAS[key].safeParse(byKey.get(key) ?? {});
    // @ts-expect-error – Schlüssel und Schema gehören zusammen
    out[key] = parsed.success ? parsed.data : defaultsFor(key);
  }
  return out;
}

export async function setSetting<K extends SettingsKey>(
  key: K,
  value: SettingsValue<K>,
  updatedBy?: string,
) {
  const parsed = SETTINGS_SCHEMAS[key].parse(value);
  await db
    .insert(settings)
    .values({ key, value: parsed, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: parsed, updatedBy, updatedAt: new Date() },
    });
  return parsed;
}
