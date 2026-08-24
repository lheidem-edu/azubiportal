"use client";

import { useRouter } from "next/navigation";
import { CalendarX } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { reportAwayToday } from "@/app/actions/absences";
import { type PersonKind } from "@/lib/people";
import { useAction } from "@/lib/use-action";

/**
 * Schnellmeldung „heute nicht da" für beide Personengruppen. Bei Azubis
 * entfällt damit die Einteilung, bei der Festbesetzung entsteht der Bedarf an
 * ganztägiger Vertretung.
 */
export function AwayTodayButton({
  personKind,
  personId,
  date,
}: {
  personKind: PersonKind;
  personId: string;
  date: string;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <ConfirmButton
      variant="outline"
      size="sm"
      disabled={pending}
      title="Für heute abwesend melden?"
      description={
        personKind === "APPRENTICE"
          ? "Du wirst für heute aus der Vertretungsplanung genommen. Die Ausbildungsleitung sieht den Eintrag in der Übersicht."
          : "Für heute wird eine ganztägige Vertretung nötig. Die Planungsverantwortlichen sehen den Eintrag sofort."
      }
      confirmLabel="Abwesend melden"
      onConfirm={() =>
        execute(() => reportAwayToday(personKind, personId, date), {
          onSuccess: () => router.refresh(),
        })
      }
    >
      <CalendarX className="size-4" />
      Heute abwesend
    </ConfirmButton>
  );
}
