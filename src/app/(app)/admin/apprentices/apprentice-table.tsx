"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/app/table-scroll";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteApprentice, setApprenticePlannable } from "@/app/actions/apprentices";
import { useAction } from "@/lib/use-action";
import { formatDateDe, weekdayShort } from "@/lib/dates";
import { ApprenticeDialog, type ApprenticeFormValues } from "./apprentice-dialog";

export type ApprenticeRow = ApprenticeFormValues & {
  id: string;
  hasAccount: boolean;
  schoolWeekdays: number[];
};

export function ApprenticeTable({ rows, canDelete }: { rows: ApprenticeRow[]; canDelete: boolean }) {
  const router = useRouter();
  const { pending, execute } = useAction();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Noch keine Auszubildenden angelegt.
      </p>
    );
  }

  return (
    <TableScroll>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Ausbildungszeit</TableHead>
            <TableHead>Schultage</TableHead>
            <TableHead>Wird geplant</TableHead>
            <TableHead className="w-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.displayName}</div>
                <div className="flex items-center gap-1.5">
                  {row.department && (
                    <span className="text-muted-foreground text-xs">{row.department}</span>
                  )}
                  {!row.hasAccount && (
                    <Badge variant="outline" className="h-5">
                      kein Login
                    </Badge>
                  )}
                  {row.loadFactor !== 1 && (
                    <Badge variant="secondary" className="h-5">
                      Faktor {row.loadFactor}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{row.email}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDateDe(row.startDate)}
                {row.endDate ? ` – ${formatDateDe(row.endDate)}` : ""}
              </TableCell>
              <TableCell>
                {row.schoolWeekdays.length === 0 ? (
                  <span className="text-muted-foreground text-sm">–</span>
                ) : (
                  <div className="flex gap-1">
                    {row.schoolWeekdays.map((day) => (
                      <Badge key={day} variant="secondary" className="h-5">
                        {weekdayShort(day)}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={row.isPlannable}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    execute(() => setApprenticePlannable(row.id, checked), {
                      onSuccess: () => router.refresh(),
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <ApprenticeDialog initial={row} />
                  {canDelete && (
                    <ConfirmButton
                      size="icon"
                      disabled={pending}
                      title={`${row.displayName} löschen?`}
                      description="Alle Einsätze, Abwesenheiten und Schultage dieser Person werden mitgelöscht. Für ausgelernte Azubis ist „Wird geplant: aus“ meist die bessere Wahl."
                      confirmLabel="Endgültig löschen"
                      onConfirm={() =>
                        execute(() => deleteApprentice(row.id), {
                          onSuccess: () => router.refresh(),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScroll>
  );
}
