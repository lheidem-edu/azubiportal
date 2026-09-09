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
import { createDeskStaff, updateDeskStaff } from "@/app/actions/desk";
import { useAction } from "@/lib/use-action";

export type DeskStaffFormValues = {
  id?: string;
  name: string;
  email: string;
  isActive: boolean;
  notes: string;
};

const EMPTY: DeskStaffFormValues = {
  name: "",
  email: "",
  isActive: true,
  notes: "",
};

export function DeskStaffDialog({
  initial,
}: {
  initial?: DeskStaffFormValues;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<DeskStaffFormValues>(initial ?? EMPTY);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof DeskStaffFormValues>(
    key: K,
    value: DeskStaffFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Beim Öffnen zurück auf den gespeicherten Stand, damit ein
        // abgebrochener Versuch nicht beim nächsten Mal wieder dasteht.
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
            Person hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Eintrag bearbeiten" : "Neue Person in der Zentrale"}
          </DialogTitle>
          <DialogDescription>
            Über die E-Mail-Adresse meldet sich die Person selbst an. Nutzen
            mehrere Personen ein Sammelkonto, tragt bei allen dieselbe Adresse
            ein.
          </DialogDescription>
        </DialogHeader>

        <form
          id="desk-staff-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute(
              () =>
                isEdit
                  ? updateDeskStaff(initial!.id!, values)
                  : createDeskStaff(values),
              {
                onSuccess: () => {
                  setOpen(false);
                  router.refresh();
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="deskName">Name</Label>
            <Input
              id="deskName"
              required
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deskEmail">E-Mail (optional)</Label>
            <Input
              id="deskEmail"
              type="email"
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Aktiv</div>
              <p className="text-muted-foreground text-xs">
                Inaktive Personen werden nicht mehr für die Zentrale eingeplant;
                die bisherigen Zuordnungen und Abwesenheiten bleiben erhalten.
              </p>
            </div>
            <Switch
              checked={values.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deskNotes">Notiz (optional)</Label>
            <Textarea
              id="deskNotes"
              rows={2}
              value={values.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="submit" form="desk-staff-form" disabled={pending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
