"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";

type Tab = { href: Route; label: string; adminOnly?: boolean };

const TABS: Tab[] = [
  { href: "/admin/apprentices", label: "Auszubildende" },
  { href: "/admin/absences", label: "Abwesenheiten" },
  { href: "/admin/desk", label: "Zentrale" },
  { href: "/admin/coverage", label: "Pausenzeiten" },
  { href: "/admin/calendar", label: "Kalender" },
  { href: "/admin/notifications", label: "Benachrichtigungen" },
  { href: "/admin/settings", label: "Einstellungen", adminOnly: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 -mx-1 flex gap-1 overflow-x-auto border-b pb-px">
      {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground border-b-2 font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
