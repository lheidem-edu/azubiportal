"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/app/table-scroll";
import { SLOT_KIND_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type LoadRow = {
  apprenticeId: string;
  apprenticeName: string;
  isPlannable: boolean;
  loadFactor: number;
  primaryCount: number;
  backupCount: number;
  fullDayCount: number;
  weighted: number;
};

/** Nur die tatsächlich benötigten Funktionen laden – hier genügt Sortieren. */
const features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
  },
});

const helper = createColumnHelper<typeof features, LoadRow>();

/**
 * Zeigt, wie gleichmäßig die Einsätze verteilt sind. „Gewichtet" berücksichtigt,
 * dass eine ganztägige Vertretung schwerer zählt als eine Pause.
 */
export function FairnessTable({ rows }: { rows: LoadRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "weighted", desc: true }]);

  const maxWeighted = useMemo(
    () => Math.max(1, ...rows.map((r) => r.weighted / (r.loadFactor || 1))),
    [rows],
  );

  const columns = useMemo(
    () => [
      helper.accessor("apprenticeName", {
        header: "Auszubildende:r",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{info.getValue()}</span>
            {!info.row.original.isPlannable && (
              <Badge variant="secondary" className="h-5">
                inaktiv
              </Badge>
            )}
            {info.row.original.loadFactor !== 1 && (
              <Badge variant="outline" className="h-5">
                Faktor {info.row.original.loadFactor}
              </Badge>
            )}
          </div>
        ),
      }),
      helper.accessor("primaryCount", { header: "Vertretungen" }),
      helper.accessor("fullDayCount", { header: `davon ${SLOT_KIND_LABEL.FULL_DAY}` }),
      helper.accessor("backupCount", { header: "als Ersatz" }),
      helper.accessor((row) => row.weighted / (row.loadFactor || 1), {
        id: "weighted",
        header: "Gewichtete Last",
        cell: (info) => {
          const value = info.getValue();
          return (
            <div className="flex items-center gap-2">
              <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.round((value / maxWeighted) * 100)}%` }}
                />
              </div>
              <span className="text-muted-foreground tabular-nums">{value.toFixed(1)}</span>
            </div>
          );
        },
      }),
    ] as unknown as ColumnDef<typeof features, LoadRow>[],
    [maxWeighted],
  );

  const table = useTable({
    features,
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Noch keine Auszubildenden angelegt.
      </p>
    );
  }

  return (
    <TableScroll>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead key={header.id}>
                    <button
                      className={cn(
                        "flex items-center gap-1",
                        header.column.getCanSort() && "hover:text-foreground",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : sorted === "desc" ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScroll>
  );
}
