"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/app/confirm-button";
import { disableDeskFeed, regenerateDeskFeedToken } from "@/app/actions/desk";
import { useAction } from "@/lib/use-action";

/**
 * Der Gesamtkalender zum Einbinden am Empfangsplatz. Er zeigt für jeden Tag,
 * wer die Vertretung übernimmt – auch wenn jemand kurzfristig einspringt.
 */
export function DeskFeed({ token }: { token: string }) {
  const router = useRouter();
  const { pending, execute } = useAction();
  const [current, setCurrent] = useState(token);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window === "undefined"
      ? `/api/ical/desk/${current}.ics`
      : `${window.location.origin}/api/ical/desk/${current}.ics`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="size-4" />
          Kalender der Zentrale
        </CardTitle>
        <CardDescription>
          Ein Abo für den Empfangsplatz: Es zeigt für jeden Tag die eingeteilte Person, und wer
          ausgefallen ist oder einspringt, steht in der Beschreibung des Termins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={url}
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
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
              <ConfirmButton
                variant="outline"
                size="sm"
                disabled={pending}
                title="Adresse zurücksetzen?"
                description="Die bisherige Adresse wird ungültig. Ein bereits eingerichtetes Abo muss danach neu angelegt werden."
                confirmLabel="Zurücksetzen"
                onConfirm={() =>
                  execute(() => regenerateDeskFeedToken(), {
                    onSuccess: (data) => {
                      if (data?.token) setCurrent(data.token);
                      router.refresh();
                    },
                  })
                }
              >
                <RefreshCw className="size-3.5" />
                Adresse zurücksetzen
              </ConfirmButton>
              <ConfirmButton
                size="sm"
                disabled={pending}
                title="Kalender abschalten?"
                description="Die Adresse wird ungültig und es entsteht keine neue. Der Kalender ist danach nicht mehr abrufbar."
                confirmLabel="Abschalten"
                onConfirm={() =>
                  execute(() => disableDeskFeed(), {
                    onSuccess: () => {
                      setCurrent("");
                      router.refresh();
                    },
                  })
                }
              >
                Abschalten
              </ConfirmButton>
            </div>
            <p className="text-muted-foreground text-xs">
              Wer die Adresse kennt, sieht den Plan – sie gehört nicht nach außen.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Es ist noch kein Kalender eingerichtet.
            </p>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                execute(() => regenerateDeskFeedToken(), {
                  onSuccess: (data) => {
                    if (data?.token) setCurrent(data.token);
                    router.refresh();
                  },
                })
              }
            >
              <CalendarPlus className="size-4" />
              Kalender einrichten
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
