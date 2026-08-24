"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings, testSmtpAction, testTeamsAction } from "@/app/actions/settings";
import { useAction } from "@/lib/use-action";
import { enumerateDe } from "@/lib/labels";
import type {
  generalSettingsSchema,
  planningSettingsSchema,
  reminderSettingsSchema,
  smtpSettingsSchema,
  teamsSettingsSchema,
} from "@/lib/settings";
import type { z } from "zod";

type General = z.infer<typeof generalSettingsSchema>;
type Planning = z.infer<typeof planningSettingsSchema>;
type Reminders = z.infer<typeof reminderSettingsSchema>;
type Smtp = z.infer<typeof smtpSettingsSchema>;
type Teams = z.infer<typeof teamsSettingsSchema>;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function GeneralSettingsForm({ initial }: { initial: General }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [values, setValues] = useState(initial);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Allgemein</CardTitle>
        <CardDescription>Grundeinstellungen für die Planung.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(() => saveSettings("general", values), { onSuccess: () => router.refresh() });
          }}
        >
          <Field label="Bezeichnung">
            <Input
              value={values.companyName}
              onChange={(e) => setValues({ ...values, companyName: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Planungshorizont (Tage)"
              hint="Wie weit im Voraus der automatische Planlauf plant."
            >
              <Input
                type="number"
                min={7}
                max={365}
                value={values.planningHorizonDays}
                onChange={(e) =>
                  setValues({ ...values, planningHorizonDays: Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label="Fairness-Fenster (Tage)"
              hint="Wie weit zurück vergangene Einsätze den Ausgleich beeinflussen."
            >
              <Input
                type="number"
                min={0}
                max={730}
                value={values.fairnessWindowDays}
                onChange={(e) =>
                  setValues({ ...values, fairnessWindowDays: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            Speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PlanningSettingsForm({
  initial,
  breakSlotLabels,
}: {
  initial: Planning;
  /** Bezeichnungen der eingerichteten Pausen – für einen passenden Hinweis. */
  breakSlotLabels: string[];
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [values, setValues] = useState(initial);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Verteilungsregeln</CardTitle>
        <CardDescription>
          Weiche Regeln: Die Automatik hält sie ein, solange jemand verfügbar ist.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(() => saveSettings("planning", values), { onSuccess: () => router.refresh() });
          }}
        >
          <ToggleField
            label="Alle Pausen eines Tages zusammen besetzen"
            hint={
              breakSlotLabels.length > 1
                ? `Dieselbe Person übernimmt ${enumerateDe(breakSlotLabels)}. Ausschalten, um jede Pause einzeln zu vergeben.`
                : "Sobald mehrere Pausen eingerichtet sind, übernimmt dieselbe Person alle Pausen eines Tages."
            }
            checked={values.combineBreaks}
            onChange={(v) => setValues({ ...values, combineBreaks: v })}
            disabled={breakSlotLabels.length < 2}
          />
          {values.combineBreaks && (
            <Field label="Bezeichnung der Tagesvertretung">
              <Input
                value={values.combinedBreakLabel}
                onChange={(e) => setValues({ ...values, combinedBreakLabel: e.target.value })}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mindestabstand (Tage)" hint="Zwischen zwei Vertretungen derselben Person.">
              <Input
                type="number"
                min={0}
                max={14}
                value={values.minGapDays}
                onChange={(e) => setValues({ ...values, minGapDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="Höchstens pro Woche" hint="Vertretungen je Person und Kalenderwoche.">
              <Input
                type="number"
                min={1}
                max={10}
                value={values.maxPerWeek}
                onChange={(e) => setValues({ ...values, maxPerWeek: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field
            label="Gewicht einer Ersatz-Nominierung"
            hint="0 = Ersatz zählt gar nicht, 1 = so viel wie eine echte Vertretung."
          >
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={values.backupWeight}
              onChange={(e) => setValues({ ...values, backupWeight: Number(e.target.value) })}
            />
          </Field>
          <ToggleField
            label="Automatischer Planlauf"
            hint="Erzeugt den Plan regelmäßig im Hintergrund (Zeitpunkt über den Worker konfigurierbar)."
            checked={values.autoPlanEnabled}
            onChange={(v) => setValues({ ...values, autoPlanEnabled: v })}
          />
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            Speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReminderSettingsForm({ initial }: { initial: Reminders }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [values, setValues] = useState(initial);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Erinnerungen</CardTitle>
        <CardDescription>Morgendliche Benachrichtigung an die Eingeteilten.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(() => saveSettings("reminders", values), { onSuccess: () => router.refresh() });
          }}
        >
          <ToggleField
            label="Erinnerungen versenden"
            checked={values.enabled}
            onChange={(v) => setValues({ ...values, enabled: v })}
          />
          <Field
            label="Uhrzeit"
            hint="Der Worker ruft den Versand zu dieser Zeit auf (REMINDER_CRON)."
          >
            <Input
              type="time"
              value={values.sendAt}
              onChange={(e) => setValues({ ...values, sendAt: e.target.value })}
            />
          </Field>
          <ToggleField
            label="Ersatzleute mitbenachrichtigen"
            hint="Sie erfahren, dass sie bei Ausfall einspringen müssten."
            checked={values.notifyBackups}
            onChange={(v) => setValues({ ...values, notifyBackups: v })}
          />
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            Speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SmtpSettingsForm({ initial }: { initial: Smtp }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [values, setValues] = useState(initial);
  const [testTo, setTestTo] = useState("");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">E-Mail (SMTP)</CardTitle>
        <CardDescription>Zugangsdaten des Mailservers für den Versand.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(() => saveSettings("smtp", values), { onSuccess: () => router.refresh() });
          }}
        >
          <ToggleField
            label="E-Mail-Versand aktiv"
            checked={values.enabled}
            onChange={(v) => setValues({ ...values, enabled: v })}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Server">
              <Input
                placeholder="mail.firma.de"
                value={values.host}
                onChange={(e) => setValues({ ...values, host: e.target.value })}
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={values.port}
                onChange={(e) => setValues({ ...values, port: Number(e.target.value) })}
              />
            </Field>
          </div>
          <ToggleField
            label="TLS ab Verbindungsaufbau (SMTPS, meist Port 465)"
            checked={values.secure}
            onChange={(v) => setValues({ ...values, secure: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Benutzer">
              <Input
                value={values.user}
                autoComplete="off"
                onChange={(e) => setValues({ ...values, user: e.target.value })}
              />
            </Field>
            <Field label="Passwort">
              <Input
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => setValues({ ...values, password: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Absender">
              <Input
                placeholder="zentrale@firma.de"
                value={values.from}
                onChange={(e) => setValues({ ...values, from: e.target.value })}
              />
            </Field>
            <Field label="Antwort an (optional)">
              <Input
                value={values.replyTo}
                onChange={(e) => setValues({ ...values, replyTo: e.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            <Save className="size-4" />
            Speichern
          </Button>
        </form>

        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <Field label="Testnachricht an">
            <Input
              type="email"
              className="w-64"
              placeholder="deine.adresse@firma.de"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={pending || !testTo}
            onClick={() => execute(() => testSmtpAction(testTo))}
          >
            <Send className="size-4" />
            Test senden
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamsSettingsForm({ initial }: { initial: Teams }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [values, setValues] = useState(initial);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Microsoft Teams</CardTitle>
        <CardDescription>
          Eingehender Webhook eines Kanals oder ein Power-Automate-Workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(() => saveSettings("teams", values), { onSuccess: () => router.refresh() });
          }}
        >
          <ToggleField
            label="Teams-Benachrichtigungen aktiv"
            checked={values.enabled}
            onChange={(v) => setValues({ ...values, enabled: v })}
          />
          <Field
            label="Webhook-Adresse"
            hint="Wird verwendet, wenn beim Auszubildenden kein persönlicher Webhook hinterlegt ist."
          >
            <Input
              placeholder="https://…"
              value={values.defaultWebhookUrl}
              onChange={(e) => setValues({ ...values, defaultWebhookUrl: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              <Save className="size-4" />
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !values.defaultWebhookUrl}
              onClick={() => execute(() => testTeamsAction())}
            >
              <Send className="size-4" />
              Test senden
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
