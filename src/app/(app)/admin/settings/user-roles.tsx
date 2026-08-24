"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setUserActive, setUserRole } from "@/app/actions/apprentices";
import { useAction } from "@/lib/use-action";
import { formatDateDe } from "@/lib/dates";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PLANNER" | "APPRENTICE" | "DESK";
  isActive: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

const ROLES = [
  { value: "APPRENTICE", label: "Auszubildende:r" },
  { value: "PLANNER", label: "Planungsverantwortlich" },
  { value: "DESK", label: "Zentrale (feste Besetzung)" },
  { value: "ADMIN", label: "Administrator" },
] as const;

export function UserRoles({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const { pending, execute } = useAction();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Benutzer</TableHead>
          <TableHead>Letzter Login</TableHead>
          <TableHead>Rolle</TableHead>
          <TableHead>Zugang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">
                {row.name}
                {row.isSelf && (
                  <Badge variant="secondary" className="ml-2 h-5">
                    du
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{row.email}</div>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {row.lastLoginAt ? formatDateDe(row.lastLoginAt.slice(0, 10)) : "nie"}
            </TableCell>
            <TableCell>
              <Select
                value={row.role}
                disabled={pending || row.isSelf}
                onValueChange={(value) =>
                  execute(() => setUserRole(row.id, value as UserRow["role"]), {
                    onSuccess: () => router.refresh(),
                  })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Switch
                checked={row.isActive}
                disabled={pending || row.isSelf}
                onCheckedChange={(checked) =>
                  execute(() => setUserActive(row.id, checked), {
                    onSuccess: () => router.refresh(),
                  })
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
