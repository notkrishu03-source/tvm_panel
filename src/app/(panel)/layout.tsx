import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        username={user.username}
        role={user.role}
        panelName={settings.panelName}
        nodeName={settings.nodeName}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
