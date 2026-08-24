"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/app/table-scroll";
import { ConfirmButton } from "@/components/app/confirm-button";
import { createSlot, deleteSlot, setSlotActive, updateSlot } from "@/app/actions/slots";
import { useAction } from "@/lib/use-action";
import { formatTime, weekdayShort } from "@/lib/dates";
import { SLOT_KIND_HINT, SLOT_KIND_LABEL } from "@/lib/labels";

export type SlotRow = {
  id: string;
  key: string;
  label: string;
  kind: "BREAK" | "FULL_DAY";
  startTime: string;
  endTime: string;
  weekdays: number[];
  weight: number;
  backupCount: number;
  isActive: boolean;
  sortOrder: number;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export function SlotManager({ rows }: { rows: SlotRow[] }) {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SlotDialog />
      </div>

      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Zeit</TableHead>
              <TableHead>Wochentage</TableHead>
              <TableHead>Ersatz</TableHead>
              <TableHead>Gewicht</TableHead>
              <TableHead>Aktiv</TableHead>
              <TableHead className="w-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-muted-foreground font-mono text-xs">{row.key}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.kind === "FULL_DAY" ? "default" : "secondary"}>
                    {SLOT_KIND_LABEL[row.kind]}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatTime(row.startTime)}–{formatTime(row.endTime)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {row.weekdays.map((day) => (
                      <Badge key={day} variant="outline" className="h-5">
                        {weekdayShort(day)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{row.backupCount}</TableCell>
                <TableCell className="tabular-nums">{row.weight.toFixed(2)}</TableCell>
                <TableCell>
                  <Switch
                    checked={row.isActive}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      execute(() => setSlotActive(row.id, checked), {
                        onSuccess: () => router.refresh(),
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <SlotDialog initial={row} />
                    <ConfirmButton
                      size="icon"
                      disabled={pending}
                      title={`„${row.label}" löschen?`}
                      description="Alle bereits geplanten Einteilungen dieses Slots werden mitgelöscht. Zum vorübergehenden Aussetzen genügt der Schalter „Aktiv“."
                      confirmLabel="Löschen"
                      onConfirm={() =>
                        execute(() => deleteSlot(row.id), { onSuccess: () => router.refresh() })
                      }
                    >
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroll>
    </div>
  );
}

const EMPTY: SlotRow = {
  id: "",
  key: "",
  label: "",
  kind: "BREAK",
  startTime: "09:00",
  endTime: "09:30",
  weekdays: [1, 2, 3, 4, 5],
  weight: 1,
  backupCount: 2,
  isActive: true,
  sortOrder: 10,
};

function SlotDialog({ initial }: { initial?: SlotRow }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SlotRow>(initial ?? EMPTY);
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof SlotRow>(key: K, value: SlotRow[K]) {
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
            Slot anlegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Slot bearbeiten" : "Neuer Slot"}</DialogTitle>
          <DialogDescription>{SLOT_KIND_HINT[values.kind]}</DialogDescription>
        </DialogHeader>

        <form
          id="slot-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              ...values,
              startTime: values.startTime.slice(0, 5),
              endTime: values.endTime.slice(0, 5),
            };
            execute(() => (isEdit ? updateSlot(initial!.id, payload) : createSlot(payload)), {
              onSuccess: () => {
                setOpen(false);
                router.refresh();
              },
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="label">Bezeichnung</Label>
              <Input
                id="label"
                required
                value={values.label}
                onChange={(e) => set("label", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">Schlüssel</Label>
              <Input
                id="key"
                required
                disabled={isEdit}
                placeholder="z.B. BREAKFAST"
                value={values.key}
                onChange={(e) => set("key", e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Art</Label>
              <Select
                value={values.kind}
                onValueChange={(value) => set("kind", value as SlotRow["kind"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BREAK">{SLOT_KIND_LABEL.BREAK}</SelectItem>
                  <SelectItem value="FULL_DAY">{SLOT_KIND_LABEL.FULL_DAY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Beginn</Label>
              <Input
                id="startTime"
                type="time"
                required
                value={values.startTime.slice(0, 5)}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Ende</Label>
              <Input
                id="endTime"
                type="time"
                required
                value={values.endTime.slice(0, 5)}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Wochentage</Label>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={values.weekdays.includes(day)}
                    onCheckedChange={(checked) =>
                      set(
                        "weekdays",
                        checked
                          ? [...values.weekdays, day].sort()
                          : values.weekdays.filter((d) => d !== day),
                      )
                    }
                  />
                  {weekdayShort(day)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="backupCount">Ersatzleute</Label>
              <Input
                id="backupCount"
                type="number"
                min="0"
                max="5"
                value={values.backupCount}
                onChange={(e) => set("backupCount", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Gewicht</Label>
              <Input
                id="weight"
                type="number"
                step="0.25"
                min="0.1"
                value={values.weight}
                onChange={(e) => set("weight", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">Reihenfolge</Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                value={values.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Das Gewicht steuert den Lastenausgleich: Je höher es ist, desto stärker belastet ein
            Einsatz das Konto der Person – und desto seltener wird sie erneut eingeteilt. 1 ist der
            Normalfall.
          </p>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="submit" form="slot-form" disabled={pending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
