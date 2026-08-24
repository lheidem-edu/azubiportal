"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const ERROR_TEXT: Record<string, string> = {
  AccessDenied:
    "Dieser Zugang ist nicht freigeschaltet. Bitte wende dich an die Ausbildungsleitung.",
  Configuration:
    "Die Anmeldung ist nicht korrekt konfiguriert. Bitte die Administration informieren.",
  CredentialsSignin: "Anmeldung fehlgeschlagen.",
};

export function LoginForm({
  entraEnabled,
  devEnabled,
  error,
}: {
  entraEnabled: boolean;
  devEnabled: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{ERROR_TEXT[error] ?? "Anmeldung fehlgeschlagen."}</AlertDescription>
        </Alert>
      )}

      {entraEnabled && (
        <Button
          className="w-full"
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signIn("microsoft-entra-id", { callbackUrl: "/" });
            })
          }
        >
          <MicrosoftLogo />
          Mit Microsoft anmelden
        </Button>
      )}

      {entraEnabled && devEnabled && (
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">oder</span>
          <Separator className="flex-1" />
        </div>
      )}

      {devEnabled && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await signIn("dev", { email, callbackUrl: "/" });
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail (Entwicklungs-Login)</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vorname.nachname@firma.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="w-full" disabled={pending}>
            Anmelden
          </Button>
          <p className="text-muted-foreground text-xs">
            Nur für die Entwicklung. In Produktion über <code>DEV_LOGIN_ENABLED</code> abschaltbar.
          </p>
        </form>
      )}

      {!entraEnabled && !devEnabled && (
        <Alert>
          <AlertDescription>
            Es ist kein Anmeldeverfahren konfiguriert. Bitte hinterlege die Entra-ID-Zugangsdaten in
            der Umgebungskonfiguration.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="size-4" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
