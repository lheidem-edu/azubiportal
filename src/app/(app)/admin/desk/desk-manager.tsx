"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmButton } from "@/components/app/confirm-button";
import {
  createDeskShift,
  createDeskStaff,
  deleteDeskShift,
  deleteDeskStaff,
} from "@/app/actions/desk";
import { useAction } from "@/lib/use-action";
import { formatDateDe, today, weekdayLabel } from "@/lib/dates";

export type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  /** Ob sich die Person bereits angemeldet und damit ein Konto hat. */
  hasAccount: boolean;
  shifts: { id: string; weekday: number; validFrom: string; validTo: string | null }[];
};

const WEEKDAYS = [1, 2, 3, 4, 5];

export function DeskManager({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Festbesetzung</CardTitle>
          <CardDescription>
            Wer sitzt regulär in der Zentrale und an welchen Wochentagen. Ist an einem Tag niemand
            eingeteilt oder fällt die Person aus, plant die Automatik ganztägige Vertretung. Über
            die hinterlegte E-Mail-Adresse meldet sich die Person selbst an; Urlaub und Ausfälle
            stehen bei den{" "}
            <Link href="/admin/absences" className="underline underline-offset-4">
              Abwesenheiten
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-3 sm:flex sm:flex-wrap sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              execute(() => createDeskStaff({ name: newName, email: newEmail, isActive: true }), {
                onSuccess: () => {
                  setNewName("");
                  setNewEmail("");
                  refresh();
                },
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="staffName">Name</Label>
              <Input
                id="staffName"
                required
                className="w-full sm:w-56"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffEmail">E-Mail (optional)</Label>
              <Input
                id="staffEmail"
                type="email"
                className="w-full sm:w-64"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              <Plus className="size-4" />
              Hinzufügen
            </Button>
          </form>

          <div className="space-y-4">
            {staff.map((person) => (
              <div key={person.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {person.name}
                      {!person.isActive && (
                        <Badge variant="secondary" className="ml-2 h-5">
                          inaktiv
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                      {person.email ?? "keine E-Mail hinterlegt"}
                      {!person.hasAccount && (
                        <Badge variant="outline" className="h-5">
                          kein Login
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ConfirmButton
                    size="icon"
                    disabled={pending}
                    title={`${person.name} entfernen?`}
                    description="Die Zuordnung zu Wochentagen und die erfassten Ausfälle werden mitgelöscht."
                    confirmLabel="Entfernen"
                    onConfirm={() =>
                      execute(() => deleteDeskStaff(person.id), { onSuccess: refresh })
                    }
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {person.shifts.length === 0 ? (
                    <span className="text-muted-foreground text-sm">
                      Noch keinem Wochentag zugeordnet.
                    </span>
                  ) : (
                    person.shifts.map((shift) => (
                      <Badge key={shift.id} variant="secondary" className="gap-1.5 py-1">
                        {weekdayLabel(shift.weekday)}
                        <span className="text-muted-foreground text-[10px]">
                          ab {formatDateDe(shift.validFrom)}
                          {shift.validTo ? ` bis ${formatDateDe(shift.validTo)}` : ""}
                        </span>
                        <button
                          className="hover:text-destructive"
                          aria-label="Zuordnung entfernen"
                          onClick={() =>
                            execute(() => deleteDeskShift(shift.id), { onSuccess: refresh })
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <ShiftForm staffId={person.id} onDone={refresh} />
              </div>
            ))}
            {staff.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Noch niemand hinterlegt.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function ShiftForm({ staffId, onDone }: { staffId: string; onDone: () => void }) {
  const { pending, execute } = useAction();
  const [weekday, setWeekday] = useState("1");
  const [validFrom, setValidFrom] = useState(today());

  return (
    <form
      className="grid gap-2 sm:flex sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        execute(() => createDeskShift({ staffId, weekday: Number(weekday), validFrom }), {
          onSuccess: onDone,
        });
      }}
    >
      <Select value={weekday} onValueChange={setWeekday}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WEEKDAYS.map((day) => (
            <SelectItem key={day} value={String(day)}>
              {weekdayLabel(day)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-full sm:w-40"
        value={validFrom}
        onChange={(event) => setValidFrom(event.target.value)}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full sm:w-auto">
        <Plus className="size-3.5" />
        Wochentag zuordnen
      </Button>
    </form>
  );
}
