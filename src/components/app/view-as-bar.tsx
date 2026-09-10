"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopViewAs } from "@/app/actions/impersonation";
import { useAction } from "@/lib/use-action";
import { ROLE_LABELS } from "@/lib/labels";
import type { Role } from "@/db/schema";

/**
 * Bleibt sichtbar, solange die Ansicht läuft. Absichtlich auffällig und über
 * allem: Wer vergisst, dass er jemand anderen ansieht, hält die Anwendung für
 * kaputt – „warum darf ich hier nichts mehr ändern?".
 */
export function ViewAsBar({
  name,
  role,
  viewerName,
}: {
  name: string;
  role: Role;
  viewerName: string;
}) {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <div className="bg-foreground text-background sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-sm">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        Ansicht von <strong className="font-semibold">{name}</strong>
        <span className="opacity-70"> · {ROLE_LABELS[role]} · nur lesen</span>
      </span>
      <span className="text-background/60 hidden text-xs sm:inline">
        angemeldet als {viewerName}
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto h-7"
        disabled={pending}
        onClick={() => execute(() => stopViewAs(), { onSuccess: () => router.refresh() })}
      >
        Ansicht beenden
      </Button>
    </div>
  );
}
