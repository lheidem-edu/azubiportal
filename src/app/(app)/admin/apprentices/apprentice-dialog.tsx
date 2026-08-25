"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createApprentice, updateApprentice } from "@/app/actions/apprentices";
import { useAction } from "@/lib/use-action";
import { numberFieldValue } from "@/lib/form-utils";
import { today } from "@/lib/dates";

export type ApprenticeFormValues = {
  id?: string;
  displayName: string;
  email: string;
  shortName: string;
  department: string;
  startDate: string;
  endDate: string;
  isPlannable: boolean;
  loadFactor: number;
  loadOffset: number;
  notifyEmail: boolean;
  notifyTeams: boolean;
  teamsWebhookUrl: string;
  notes: string;
};

const EMPTY: ApprenticeFormValues = {
  displayName: "",
  email: "",
  shortName: "",
  department: "",
  startDate: today(),
  endDate: "",
  isPlannable: true,
  loadFactor: 1,
  loadOffset: 0,
  notifyEmail: true,
  notifyTeams: false,
  teamsWebhookUrl: "",
  notes: "",
};

export function ApprenticeDialog({ initial }: { initial?: ApprenticeFormValues }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ApprenticeFormValues>(initial ?? EMPTY);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof ApprenticeFormValues>(key: K, value: ApprenticeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(initial ?? EMPTY);
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Bearbeiten">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Auszubildende:n anlegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Auszubildende:n bearbeiten" : "Neue:r Auszubildende:r"}</DialogTitle>
          <DialogDescription>
            Die E-Mail-Adresse verknüpft den Eintrag automatisch mit dem Microsoft-Konto beim ersten
            Login.
          </DialogDescription>
        </DialogHeader>

        <form
          id="apprentice-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = { ...values, endDate: values.endDate || "" };
            execute(
              () => (isEdit ? updateApprentice(initial!.id!, payload) : createApprentice(payload)),
              {
                onSuccess: () => {
                  setOpen(false);
                  router.refresh();
                },
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                required
                value={values.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortName">Kürzel (optional)</Label>
              <Input
                id="shortName"
                value={values.shortName}
                onChange={(e) => set("shortName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Ausbildungsbeginn</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Ausbildungsende (optional)</Label>
              <Input
                id="endDate"
                type="date"
                min={values.startDate}
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Abteilung (optional)</Label>
            <Input
              id="department"
              value={values.department}
              onChange={(e) => set("department", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="loadFactor">Einsatzfaktor</Label>
              {/* `step="any"`: Ein Raster ab `min` würde runde Werte ungültig
                  machen und das Absenden ohne sichtbaren Grund blockieren. */}
              <Input
                id="loadFactor"
                type="number"
                step="any"
                min="0.1"
                max="3"
                required
                value={numberFieldValue(values.loadFactor)}
                onChange={(e) => set("loadFactor", e.target.valueAsNumber)}
              />
              <p className="text-muted-foreground text-xs">
                1,0 = normal · 0,5 = halb so oft (z.B. Teilzeit)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loadOffset">Startguthaben</Label>
              <Input
                id="loadOffset"
                type="number"
                step="any"
                required
                value={numberFieldValue(values.loadOffset)}
                onChange={(e) => set("loadOffset", e.target.valueAsNumber)}
              />
              <p className="text-muted-foreground text-xs">
                Vorbelastung für später Hinzugekommene, damit sie nicht sofort dauerhaft dran sind.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <ToggleRow
              label="Wird eingeplant"
              description="Deaktivieren statt löschen, wenn jemand vorübergehend nicht vertreten soll."
              checked={values.isPlannable}
              onChange={(v) => set("isPlannable", v)}
            />
            <ToggleRow
              label="Erinnerung per E-Mail"
              checked={values.notifyEmail}
              onChange={(v) => set("notifyEmail", v)}
            />
            <ToggleRow
              label="Erinnerung per Teams"
              checked={values.notifyTeams}
              onChange={(v) => set("notifyTeams", v)}
            />
            {values.notifyTeams && (
              <div className="space-y-1.5">
                <Label htmlFor="teamsWebhookUrl">Persönlicher Teams-Webhook (optional)</Label>
                <Input
                  id="teamsWebhookUrl"
                  placeholder="Leer lassen, um den allgemeinen Kanal zu nutzen"
                  value={values.teamsWebhookUrl}
                  onChange={(e) => set("teamsWebhookUrl", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notiz (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="submit" form="apprentice-form" disabled={pending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
