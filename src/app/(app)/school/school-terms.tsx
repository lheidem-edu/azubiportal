"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/app/confirm-button";
import { createSchoolTerm, deleteSchoolTerm } from "@/app/actions/school";
import { useAction } from "@/lib/use-action";
import { formatDateDe, today, weekdayLabel } from "@/lib/dates";

export type SchoolTermRow = {
  id: string;
  apprenticeId: string;
  apprenticeName?: string;
  weekday: number;
  validFrom: string;
  validTo: string | null;
  intervalWeeks: number;
  anchorWeek: string | null;
  note: string | null;
};

const WEEKDAYS = [1, 2, 3, 4, 5];

export function SchoolTermForm({
  apprenticeId,
  apprenticeOptions,
}: {
  apprenticeId: string | null;
  apprenticeOptions?: { id: string; name: string }[];
}) {
  const { pending, execute } = useAction();
  const [target, setTarget] = useState(apprenticeId ?? apprenticeOptions?.[0]?.id ?? "");
  const [weekday, setWeekday] = useState("1");
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [intervalWeeks, setIntervalWeeks] = useState("1");
  const [anchorWeek, setAnchorWeek] = useState(today());

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        execute(() =>
          createSchoolTerm({
            apprenticeId: target,
            weekday: Number(weekday),
            validFrom,
            validTo: validTo || undefined,
            intervalWeeks: Number(intervalWeeks),
            anchorWeek: Number(intervalWeeks) > 1 ? anchorWeek : undefined,
          }),
        );
      }}
    >
      {apprenticeOptions && (
        <div className="space-y-1.5">
          <Label>Auszubildende:r</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Bitte auswählen" />
            </SelectTrigger>
            <SelectContent>
              {apprenticeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Wochentag</Label>
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger className="w-full">
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
        </div>
        <div className="space-y-1.5">
          <Label>Rhythmus</Label>
          <Select value={intervalWeeks} onValueChange={setIntervalWeeks}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Jede Woche</SelectItem>
              <SelectItem value="2">Alle 2 Wochen</SelectItem>
              <SelectItem value="3">Alle 3 Wochen</SelectItem>
              <SelectItem value="4">Alle 4 Wochen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {Number(intervalWeeks) > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="anchorWeek">Erster Schultag in diesem Rhythmus</Label>
          <Input
            id="anchorWeek"
            type="date"
            value={anchorWeek}
            onChange={(event) => setAnchorWeek(event.target.value)}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="validFrom">Gültig ab</Label>
          <Input
            id="validFrom"
            type="date"
            required
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validTo">Gültig bis (optional)</Label>
          <Input
            id="validTo"
            type="date"
            min={validFrom}
            value={validTo}
            onChange={(event) => setValidTo(event.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending || !target} className="w-full sm:w-auto">
        <Plus className="size-4" />
        Schultag hinzufügen
      </Button>
    </form>
  );
}

export function SchoolTermList({
  rows,
  showApprentice,
}: {
  rows: SchoolTermRow[];
  showApprentice?: boolean;
}) {
  const { pending, execute } = useAction();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Noch keine Schultage hinterlegt.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const expired = row.validTo && row.validTo < today();
        return (
          <li
            key={row.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 ${
              expired ? "opacity-60" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              {showApprentice && <div className="text-sm font-medium">{row.apprenticeName}</div>}
              <div className={showApprentice ? "text-muted-foreground text-sm" : "text-sm font-medium"}>
                {weekdayLabel(row.weekday)}
                {row.intervalWeeks > 1 && (
                  <Badge variant="secondary" className="ml-2 h-5">
                    alle {row.intervalWeeks} Wochen
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                ab {formatDateDe(row.validFrom)}
                {row.validTo ? ` bis ${formatDateDe(row.validTo)}` : ""}
              </div>
            </div>
            <ConfirmButton
              size="icon"
              disabled={pending}
              title="Schultag entfernen?"
              description="Der Eintrag wird gelöscht. Bereits erzeugte Pläne bleiben unverändert – bitte danach neu planen."
              confirmLabel="Entfernen"
              onConfirm={() => execute(() => deleteSchoolTerm(row.id))}
            >
              <Trash2 className="size-4" />
            </ConfirmButton>
          </li>
        );
      })}
    </ul>
  );
}
