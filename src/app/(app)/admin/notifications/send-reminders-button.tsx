"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ConfirmButton } from "@/components/app/confirm-button";
import { sendRemindersNowAction } from "@/app/actions/settings";
import { useAction } from "@/lib/use-action";

export function SendRemindersButton() {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <ConfirmButton
      variant="outline"
      size="default"
      disabled={pending}
      title="Erinnerungen jetzt versenden?"
      description="Alle heute eingeteilten Personen erhalten ihre Benachrichtigung. Bereits versendete Nachrichten werden nicht erneut verschickt."
      confirmLabel="Versenden"
      onConfirm={() => execute(() => sendRemindersNowAction(), { onSuccess: () => router.refresh() })}
    >
      <Send className="size-4" />
      Jetzt versenden
    </ConfirmButton>
  );
}
