import { cookies } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { Providers } from "@/components/app/providers";
import { ViewAsBar } from "@/components/app/view-as-bar";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);

  // Die Seitenleiste merkt sich ihren Zustand im Cookie; ohne das Auslesen
  // auf dem Server würde sie beim ersten Rendern kurz aufklappen.
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <Providers>
      {user.viewedBy && (
        <ViewAsBar name={user.name} role={user.role} viewerName={user.viewedBy.name} />
      )}
      <AppShell user={user} defaultOpen={defaultOpen}>
        {children}
      </AppShell>
    </Providers>
  );
}
