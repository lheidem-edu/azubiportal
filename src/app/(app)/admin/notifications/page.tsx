import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/app/table-scroll";
import { requirePlanner } from "@/lib/session";
import { recentNotifications } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { formatDateDe } from "@/lib/dates";
import { SendRemindersButton } from "./send-reminders-button";

export const metadata = { title: "Benachrichtigungen" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SENT: "default",
  PENDING: "outline",
  SKIPPED: "secondary",
  FAILED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  SENT: "versendet",
  PENDING: "offen",
  SKIPPED: "übersprungen",
  FAILED: "fehlgeschlagen",
};

export default async function NotificationsPage() {
  await requirePlanner();
  const [rows, reminders, smtp, teams] = await Promise.all([
    recentNotifications(60),
    getSetting("reminders"),
    getSetting("smtp"),
    getSetting("teams"),
  ]);

  return (
    <>
      <PageHeader
        title="Benachrichtigungen"
        description="Morgendliche Erinnerungen an Vertretung und Ersatz."
        actions={<SendRemindersButton />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatusCard
          title="Erinnerungen"
          value={reminders.enabled ? `täglich um ${reminders.sendAt} Uhr` : "deaktiviert"}
          ok={reminders.enabled}
          hint={reminders.notifyBackups ? "inkl. Ersatzleute" : "nur die Vertretung"}
        />
        <StatusCard
          title="E-Mail (SMTP)"
          value={smtp.enabled ? smtp.host || "kein Server hinterlegt" : "deaktiviert"}
          ok={smtp.enabled && Boolean(smtp.host)}
          hint={smtp.enabled ? `Absender: ${smtp.from}` : "unter Einstellungen aktivierbar"}
        />
        <StatusCard
          title="Microsoft Teams"
          value={teams.enabled ? (teams.defaultWebhookUrl ? "Webhook aktiv" : "kein Webhook") : "deaktiviert"}
          ok={teams.enabled && Boolean(teams.defaultWebhookUrl)}
          hint="Adaptive Card in den Kanal"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versandverlauf</CardTitle>
          <CardDescription>
            Die letzten 60 Nachrichten. Konfiguration unter{" "}
            <Link href="/admin/settings" className="underline underline-offset-4">
              Einstellungen
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Es wurde noch nichts versendet.
            </p>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Betreff</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateDe(row.createdAt.toISOString().slice(0, 10))}{" "}
                        {row.createdAt.toTimeString().slice(0, 5)}
                      </TableCell>
                      <TableCell>{row.apprenticeName ?? "–"}</TableCell>
                      <TableCell>{row.channel === "EMAIL" ? "E-Mail" : "Teams"}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.subject}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                        {row.error && (
                          <div className="text-destructive mt-0.5 max-w-xs truncate text-xs">
                            {row.error}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatusCard({
  title,
  value,
  hint,
  ok,
}: {
  title: string;
  value: string;
  hint: string;
  ok: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          <span className="text-muted-foreground text-xs">{title}</span>
        </div>
        <div className="mt-1 text-sm font-medium">{value}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>
      </CardContent>
    </Card>
  );
}
