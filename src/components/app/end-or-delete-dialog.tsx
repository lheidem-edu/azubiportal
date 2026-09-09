"use client";

import { useState } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/app/date-picker";
import { today } from "@/lib/dates";

/**
 * Zwei Wege, eine Zuordnung loszuwerden – mit einem deutlichen Unterschied.
 *
 * Beenden setzt einen Stichtag: Ab dann gilt sie nicht mehr, vorher schon.
 * Das ist fast immer das Gemeinte, wenn jemand einen Tag abgibt. Löschen
 * entfernt sie rückwirkend aus der Geschichte – vergangene Pläne verlieren
 * damit ihre Begründung. Deshalb steht es abgesetzt und braucht einen
 * zweiten Klick.
 */
export function EndOrDeleteDialog({
  trigger,
  title,
  description,
  minDate,
  deleteWarning,
  onEnd,
  onDelete,
  pending,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  /** Frühester Stichtag – vor dem Beginn zu enden ergibt keinen Sinn. */
  minDate: string;
  deleteWarning: string;
  onEnd: (validTo: string) => void;
  onDelete: () => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [validTo, setValidTo] = useState(() => (minDate > today() ? minDate : today()));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValidTo(minDate > today() ? minDate : today());
          setConfirmDelete(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <DatePicker
            id="validTo"
            label="Gilt letztmalig am"
            min={minDate}
            value={validTo}
            onChange={setValidTo}
          />
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              onEnd(validTo);
              setOpen(false);
            }}
          >
            <CalendarOff className="size-4" />
            Beenden
          </Button>
        </div>

        <div className="border-t pt-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">{deleteWarning}</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Zurück
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => {
                    onDelete();
                    setOpen(false);
                  }}
                >
                  Ja, löschen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Stattdessen ganz löschen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
