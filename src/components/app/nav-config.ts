import {
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  Palmtree,
  Settings,
  Table2,
  Users,
  Wand2,
} from "lucide-react";
import { canPlan, isAdmin } from "@/lib/labels";
import type { Role } from "@/db/schema";

/**
 * Aufbau der Navigation.
 *
 * Jede Gruppe ist ein Bereich des Portals. Die Vertretungsplanung der Zentrale
 * ist der erste; kommt später etwas dazu, das nichts mit der Zentrale zu tun
 * hat, bekommt es eine eigene Gruppe – die Anzeige richtet sich allein nach
 * dieser Liste.
 */

/** Was der angemeldete Benutzer ist – entscheidet über die Sichtbarkeit. */
export type NavContext = {
  role: Role;
  apprenticeId: string | null;
  deskStaffId: string | null;
};

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Sichtbar, wenn diese Bedingung zutrifft. Ohne Angabe: für alle. */
  when?: (ctx: NavContext) => boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const isApprentice = (ctx: NavContext) => Boolean(ctx.apprenticeId);
const isDeskStaff = (ctx: NavContext) => Boolean(ctx.deskStaffId);

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Übersicht",
    items: [
      { href: "/", label: "Start", icon: LayoutDashboard },
      { href: "/year", label: "Jahresübersicht", icon: Table2 },
    ],
  },
  {
    title: "Zentrale",
    items: [
      { href: "/schedule", label: "Vertretungsplan", icon: CalendarRange },
      { href: "/my-schedule", label: "Mein Plan", icon: CalendarDays, when: isApprentice },
      { href: "/planning", label: "Plan erstellen", icon: Wand2, when: (c) => canPlan(c.role) },
    ],
  },
  {
    title: "Meine Daten",
    items: [
      {
        href: "/absences",
        label: "Urlaub & Abwesenheit",
        icon: Palmtree,
        when: (ctx) => isApprentice(ctx) || isDeskStaff(ctx),
      },
      { href: "/school", label: "Schultage", icon: GraduationCap, when: isApprentice },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { href: "/admin", label: "Stammdaten", icon: Users, when: (c) => canPlan(c.role) },
      {
        href: "/admin/settings",
        label: "Einstellungen",
        icon: Settings,
        when: (c) => isAdmin(c.role),
      },
    ],
  },
];

export function visibleGroups(ctx: NavContext): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.when || item.when(ctx)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Ermittelt den aktiven Navigationspunkt: der längste passende Pfad gewinnt,
 * damit z.B. „/admin/settings" nicht zusätzlich „/admin" markiert und
 * „/schedule" nicht bei „/my-schedule" aufleuchtet.
 */
export function activeHref(pathname: string, groups: NavGroup[]): string | null {
  const candidates = groups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}
