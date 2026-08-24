"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAbsence } from "@/app/actions/absences";
import { type PersonKind, type PersonOption } from "@/lib/people";
import { useAction } from "@/lib/use-action";
import { today } from "@/lib/dates";

export const ABSENCE_TYPES = [
  { value: "VACATION", label: "Urlaub", forKind: ["APPRENTICE", "DESK"] },
  { value: "SICK", label: "Krank", forKind: ["APPRENTICE", "DESK"] },
  { value: "SCHOOL_BLOCK", label: "Blockunterricht", forKind: ["APPRENTICE"] },
  { value: "TRAINING", label: "Lehrgang / Prüfung", forKind: ["APPRENTICE", "DESK"] },
  { value: "OTHER", label: "Sonstiges", forKind: ["APPRENTICE", "DESK"] },
] as const;

const DAY_PARTS = [
  { value: "FULL", label: "Ganzer Tag" },
  { value: "MORNING", label: "Nur vormittags" },
  { value: "AFTERNOON", label: "Nur nachmittags" },
] as const;

/**
 * Ein Formular für alle: Auszubildende und feste Zentrale-Besetzung.
 * Wer nur für sich selbst eintragen darf, bekommt kein Auswahlfeld zu sehen.
 */
export function AbsenceForm({
  people,
  defaultPerson,
  lockPerson,
}: {
  people: PersonOption[];
  defaultPerson?: string;
  /** Kein Personenwechsel – der Benutzer trägt nur für sich selbst ein. */
  lockPerson?: boolean;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [person, setPerson] = useState(defaultPerson ?? people[0]?.value ?? "");
  const [type, setType] = useState<string>("VACATION");
  const [dayPart, setDayPart] = useState("FULL");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("");

  const selected = people.find((p) => p.value === person);
  const kind: PersonKind = selected?.kind ?? "APPRENTICE";
  const availableTypes = ABSENCE_TYPES.filter((t) =>
    (t.forKind as readonly string[]).includes(kind),
  );
  const apprenticeOptions = people.filter((p) => p.kind === "APPRENTICE");
  const deskOptions = people.filter((p) => p.kind === "DESK");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected) return;
        execute(
          () =>
            createAbsence({
              personKind: selected.kind,
              personId: selected.id,
              type,
              dayPart,
              startDate,
              endDate,
              reason: reason || undefined,
            }),
          {
            onSuccess: () => {
              setReason("");
              router.refresh();
            },
          },
        );
      }}
    >
      {!lockPerson && (
        <div className="space-y-1.5">
          <Label>Person</Label>
          <Select
            value={person}
            onValueChange={(value) => {
              setPerson(value);
              const next = people.find((p) => p.value === value);
              if (next?.kind === "DESK") {
                setDayPart("FULL");
                if (type === "SCHOOL_BLOCK") setType("VACATION");
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Bitte auswählen" />
            </SelectTrigger>
            <SelectContent>
              {apprenticeOptions.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Auszubildende</SelectLabel>
                  {apprenticeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {deskOptions.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Zentrale</SelectLabel>
                  {deskOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Grund</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "APPRENTICE" && (
          <div className="space-y-1.5">
            <Label>Umfang</Label>
            <Select
              value={dayPart}
              onValueChange={(value) => {
                setDayPart(value);
                if (value !== "FULL") setEndDate(startDate);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_PARTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Von</Label>
          <Input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (event.target.value > endDate || dayPart !== "FULL") {
                setEndDate(event.target.value);
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Bis</Label>
          <Input
            id="endDate"
            type="date"
            required
            min={startDate}
            disabled={dayPart !== "FULL"}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Bemerkung (optional)</Label>
        <Textarea
          id="reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={pending || !selected} className="w-full sm:w-auto">
        <Plus className="size-4" />
        Eintragen
      </Button>
    </form>
  );
}
