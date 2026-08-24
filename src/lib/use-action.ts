"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-utils";

/**
 * Kleiner Helfer, der Server-Actions ausführt und das Ergebnis als
 * Kurzmeldung anzeigt. Dadurch sehen alle Formulare gleich aus.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function execute<T>(
    action: () => Promise<ActionResult<T>>,
    options: { onSuccess?: (data?: T) => void; successMessage?: string } = {},
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(options.successMessage ?? result.message ?? "Gespeichert.");
          options.onSuccess?.(result.data);
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unerwarteter Fehler.");
      }
    });
  }

  return { pending, execute };
}
