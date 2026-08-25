/**
 * Beschriftungen und Rollenprüfungen ohne Server-Abhängigkeiten.
 * Diese Datei darf sowohl im Browser als auch auf dem Server importiert werden.
 */
import type { Role, SlotKind } from "@/db/schema";

const RANK_LABEL: Record<number, string> = {
  1: "Vertretung",
  2: "1. Ersatz",
  3: "2. Ersatz",
};

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? `${rank - 1}. Ersatz`;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PLANNER: "Planungsverantwortlich",
  APPRENTICE: "Auszubildende:r",
  DESK: "Zentrale",
};

export function canPlan(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "PLANNER";
}

export function isAdmin(role: Role | undefined): boolean {
  return role === "ADMIN";
}

/**
 * Die beiden Arten von Vertretung. Ihre Bezeichnung steht hier an einer
 * Stelle – die Slots selbst (Zeiten, Namen, Anzahl) sind frei konfigurierbar
 * und dürfen in Texten nicht vorausgesetzt werden.
 */
export const SLOT_KIND_LABEL: Record<SlotKind, string> = {
  BREAK: "Pause",
  FULL_DAY: "Ganztags",
};

export const SLOT_KIND_HINT: Record<SlotKind, string> = {
  BREAK: "Wird an jedem Arbeitstag besetzt, an dem die Zentrale regulär besetzt ist.",
  FULL_DAY: "Wird nur geplant, wenn die feste Besetzung der Zentrale an diesem Tag ausfällt.",
};

/** Zählt Bezeichnungen sprachlich auf: „A", „A und B", „A, B und C". */
export function enumerateDe(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`;
}

/**
 * Beschreibt die Rolle innerhalb eines Dienstes. Wird der Dienst von einer
 * Person aus einem anderen übernommen – etwa die Pausen an einem Ganztagstag –,
 * steht das dabei, damit im Plan erkennbar bleibt, woher sie kommt.
 */
export function dutyRoleLabel(
  rank: number,
  derivedFrom?: { rank: number } | null,
): string {
  if (derivedFrom && rank === 1) return rankLabel(derivedFrom.rank);
  return rankLabel(rank);
}
