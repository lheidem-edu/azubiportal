"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { regenerateIcsToken } from "@/app/actions/apprentices";
import { useAction } from "@/lib/use-action";
import { ConfirmButton } from "@/components/app/confirm-button";

export function CalendarSubscription({
  apprenticeId,
  token,
  baseUrl,
}: {
  apprenticeId: string;
  token: string;
  /** Öffentliche Adresse der Anwendung – kommt vom Server, damit die
   *  angezeigte Abo-Adresse hinter einem Reverse-Proxy stimmt. */
  baseUrl: string;
}) {
  const [current, setCurrent] = useState(token);
  const [copied, setCopied] = useState(false);
  const { pending, execute } = useAction();

  const path = `/api/ical/${current}.ics`;
  const url = `${baseUrl}${path}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button variant="outline" size="icon" onClick={copy} aria-label="Adresse kopieren">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>

      <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
        <li>Adresse kopieren.</li>
        <li>
          In Outlook: <strong>Kalender hinzufügen → Aus dem Internet abonnieren</strong>.
        </li>
        <li>Adresse einfügen und bestätigen.</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={path}>Datei herunterladen</a>
        </Button>
        <ConfirmButton
          variant="ghost"
          size="sm"
          disabled={pending}
          title="Kalender-Adresse zurücksetzen?"
          description="Die bisherige Adresse wird ungültig. Ein bereits eingerichtetes Abo in Outlook muss danach neu angelegt werden."
          confirmLabel="Zurücksetzen"
          onConfirm={() =>
            execute(() => regenerateIcsToken(apprenticeId), {
              onSuccess: (data) => {
                if (data?.token) setCurrent(data.token);
              },
            })
          }
        >
          <RefreshCw className="size-3.5" />
          Adresse zurücksetzen
        </ConfirmButton>
      </div>

      <p className="text-muted-foreground text-xs">
        Die Adresse ist persönlich – wer sie kennt, sieht deinen Plan. Bitte nicht weitergeben.
      </p>
    </div>
  );
}
