"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { osFamilyOf, OsIcon } from "@/components/OsIcon";
import { Badge, Button, ConfirmModal, CopyButton, StatusBadge } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { ConsoleTab } from "@/components/vm/ConsoleTab";
import { FilesTab } from "@/components/vm/FilesTab";
import { LogsTab } from "@/components/vm/LogsTab";
import { DiskTab, MediaTab, NetworkTab, ReinstallTab, SettingsTab } from "@/components/vm/ManageTabs";
import { OverviewTab } from "@/components/vm/OverviewTab";
import { vmAction, type IsoOption, type Metrics, type TemplateOption } from "@/components/vm/types";
import type { ClientVm, MetricSample } from "@/lib/vm";

type Tab =
  | "overview"
  | "console"
  | "files"
  | "reinstall"
  | "iso"
  | "disk"
  | "network"
  | "settings"
  | "logs";

const baseTabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "activity" },
  { id: "console", label: "Console", icon: "terminal" },
  { id: "files", label: "Files", icon: "list" },
  { id: "reinstall", label: "Reinstall", icon: "refresh" },
  { id: "iso", label: "ISO", icon: "disc" },
  { id: "disk", label: "Disk", icon: "hdd" },
  { id: "network", label: "Network", icon: "network" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "logs", label: "Logs", icon: "list" },
];

const adminTabs: { id: Tab; label: string; icon: IconName }[] = baseTabs;

export function VmDetail({
  initialVm,
  templates,
  isos,
  isAdmin,
  viewerId,
}: {
  initialVm: ClientVm;
  templates: TemplateOption[];
  isos: IsoOption[];
  isAdmin: boolean;
  viewerId: number;
}) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [vm, setVm] = useState(initialVm);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<MetricSample[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [kill, setKill] = useState(false);
  const vmId = initialVm.id;

  const reload = useCallback(
    async (withHistory = false) => {
      try {
        const res = await fetch(`/api/vms/${vmId}${withHistory ? "?history=1" : ""}`, { cache: "no-store" });
        if (res.status === 401) return router.replace("/login");
        if (res.status === 404) return router.replace("/dashboard");
        if (!res.ok) return;
        const data = (await res.json()) as { vm: ClientVm; metrics: Metrics };
        setVm(data.vm);
        setMetrics(data.metrics);
        setHistory((prev) => {
          const incoming = data.metrics.history ?? [data.metrics.current];
          const merged = withHistory
            ? incoming
            : prev.at(-1)?.t === incoming[0].t
              ? [...prev.slice(0, -1), ...incoming]
              : [...prev, ...incoming];
          return merged.slice(-30);
        });
      } catch {
        // transient network error; the next tick retries
      }
    },
    [vmId, router],
  );
  const refresh = useCallback(() => reload(false), [reload]);

  useEffect(() => {
    void reload(true);
    const id = setInterval(() => {
      if (!document.hidden) void reload(false);
    }, 2000);
    return () => clearInterval(id);
  }, [reload]);

  const power = async (op: "start" | "stop" | "restart" | "kill") => {
    await run(op, () => vmAction(vm.id, { action: "power", op }), {
      success: { start: "Starting VM…", stop: "Shutting down…", restart: "Restarting…", kill: "VM powered off" }[op],
      refresh: false,
    });
    await reload(false);
  };

  const transitional = vm.status === "starting" || vm.status === "stopping" || vm.status === "installing";
  const blocked = transitional || (vm.suspended && !isAdmin);
  const foreign = vm.ownerId !== viewerId;
  const back = isAdmin && foreign ? { href: "/admin/vms", label: "All VMs" } : { href: "/dashboard", label: "My Servers" };

  const tabs = isAdmin ? adminTabs : baseTabs;
  const tabProps = { vm, isAdmin, reload: refresh };

  return (
    <div>
      <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-200">
        <Icon name="back" size={15} /> {back.label}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <OsIcon family={osFamilyOf(vm.osName)} size={52} />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{vm.name}</h1>
              <StatusBadge status={vm.status} suspended={vm.suspended} />
              {foreign && <Badge tone="blue">owner: {vm.ownerName}</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
              {vm.osName} <span className="text-zinc-700">·</span>
              <span className="font-mono text-zinc-400">{vm.ipv4}</span>
              <CopyButton value={vm.ipv4} />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="success" loading={busy === "start"} disabled={blocked || vm.status !== "stopped"} onClick={() => power("start")}>
            <Icon name="play" size={13} /> Start
          </Button>
          <Button loading={busy === "restart"} disabled={blocked || vm.status !== "running"} onClick={() => power("restart")}>
            <Icon name="refresh" size={14} /> Restart
          </Button>
          <Button variant="danger" loading={busy === "stop"} disabled={blocked || vm.status !== "running"} onClick={() => power("stop")}>
            <Icon name="stop" size={13} /> Shut down
          </Button>
          <Button variant="ghost" disabled={vm.status === "stopped" || vm.status === "installing" || (vm.suspended && !isAdmin)} onClick={() => setKill(true)} title="Force power off">
            <Icon name="power" size={15} /> Force off
          </Button>
        </div>
      </div>

      {vm.status === "installing" && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          Installing {vm.osName}… provisioning disk image and cloud-init configuration.
        </div>
      )}
      {vm.suspended && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          This VM is suspended by an administrator.{isAdmin ? " You can unsuspend it in Settings." : " Contact support for assistance."}
        </div>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              tab === t.id ? "border-brand text-brand-soft" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="tn-fade" key={tab}>
        {tab === "overview" && <OverviewTab vm={vm} metrics={metrics} history={history} />}
        {tab === "console" && <ConsoleTab {...tabProps} />}
        {tab === "files" && <FilesTab {...tabProps} />}
        {tab === "reinstall" && <ReinstallTab {...tabProps} templates={templates} />}
        {tab === "iso" && <MediaTab {...tabProps} isos={isos} />}
        {tab === "disk" && <DiskTab {...tabProps} metrics={metrics} />}
        {tab === "network" && <NetworkTab {...tabProps} />}
        {tab === "settings" && <SettingsTab {...tabProps} />}
        {tab === "logs" && <LogsTab {...tabProps} />}
      </div>

      <ConfirmModal
        open={kill}
        onClose={() => setKill(false)}
        title="Force power off"
        confirmLabel="Force off"
        description="This is like pulling the power cable. Unsaved data in the guest may be lost and filesystems may need a check on next boot."
        onConfirm={async () => {
          await power("kill");
          setKill(false);
        }}
      />
    </div>
  );
}
