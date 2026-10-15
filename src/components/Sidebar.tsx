"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Logo, useToast } from "@/components/ui";
import { api } from "@/lib/client-api";

type Item = { href: string; label: string; icon: IconName; match?: (p: string) => boolean };

const userItems: Item[] = [
  {
    href: "/dashboard",
    label: "My Servers",
    icon: "server",
    match: (p) => p === "/dashboard" || p.startsWith("/vms"),
  },
  { href: "/profile", label: "Account", icon: "user" },
];

const adminItems: Item[] = [
  { href: "/admin", label: "Overview", icon: "dashboard", match: (p) => p === "/admin" },
  { href: "/admin/vms", label: "All VMs", icon: "cpu" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/nodes", label: "Nodes", icon: "server" },
  { href: "/admin/templates", label: "Templates & ISOs", icon: "disc" },
  { href: "/admin/logs", label: "Activity", icon: "activity" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export function Sidebar({
  username,
  role,
  panelName,
  nodeName,
}: {
  username: string;
  role: "admin" | "user";
  panelName: string;
  nodeName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const renderItem = (item: Item) => {
    const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-brand/10 text-brand-soft ring-1 ring-inset ring-brand/20"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
        }`}
      >
        <Icon name={item.icon} size={17} className={active ? "text-brand" : "text-zinc-500 group-hover:text-zinc-300"} />
        {item.label}
      </Link>
    );
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", "POST");
    } catch {
      toast("Could not sign out", "error");
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          <Logo name={panelName} />
        </Link>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Node <span className="font-mono text-zinc-400">{nodeName}</span>
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Services</p>
          {userItems.map(renderItem)}
        </div>
        {role === "admin" && (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              <Icon name="shield" size={11} /> Administration
            </p>
            {adminItems.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="m-3 rounded-xl border border-line bg-panel2/60 p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-soft to-orange-700 text-sm font-bold uppercase text-black">
            {username.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{username}</p>
            <p className="text-[11px] capitalize text-zinc-500">{role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-red-300"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo name={panelName} size={28} />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 text-zinc-300 hover:bg-white/10">
          <Icon name="menu" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-panel/70 backdrop-blur lg:block">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="tn-fade fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-line bg-panel" onClick={(e) => e.stopPropagation()}>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
