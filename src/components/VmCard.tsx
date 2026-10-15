"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { osFamilyOf, OsIcon } from "@/components/OsIcon";
import { Button, StatusBadge } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtMb } from "@/lib/format";
import type { ClientVm } from "@/lib/vm";

export function VmCard({ vm, showOwner }: { vm: ClientVm; showOwner?: boolean }) {
  const { run, busy } = useRun();
  const power = (op: "start" | "stop" | "restart") =>
    run(op, () => api(`/api/vms/${vm.id}/action`, "POST", { action: "power", op }), {
      success: op === "start" ? "Starting VM…" : op === "stop" ? "Shutting down…" : "Restarting…",
    });

  const locked = vm.status === "installing" || vm.status === "starting" || vm.status === "stopping" || (vm.suspended && !showOwner);

  return (
    <div className="group relative rounded-xl border border-line bg-panel/90 p-4 transition hover:border-brand/40 hover:bg-panel2/90">
      <Link href={`/vms/${vm.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${vm.name}`} />
      <div className="pointer-events-none relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <OsIcon family={osFamilyOf(vm.osName)} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{vm.name}</p>
            <p className="truncate text-xs text-zinc-500">{vm.osName}</p>
          </div>
        </div>
        <StatusBadge status={vm.status} suspended={vm.suspended} />
      </div>

      <dl className="pointer-events-none relative mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["vCPU", String(vm.cpuCores)],
          ["RAM", fmtMb(vm.ramMb)],
          ["Disk", `${vm.diskGb} GB`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-bg/60 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-4 flex items-center justify-between gap-2">
        <div className="pointer-events-none min-w-0">
          <p className="truncate font-mono text-xs text-zinc-400">{vm.ipv4}</p>
          {showOwner && <p className="truncate text-[11px] text-zinc-600">owner: {vm.ownerName}</p>}
        </div>
        <div className="relative z-10 flex gap-1.5">
          {vm.status === "stopped" ? (
            <Button size="sm" variant="success" loading={busy === "start"} disabled={locked} onClick={() => power("start")}>
              <Icon name="play" size={12} /> Start
            </Button>
          ) : (
            <>
              <Button size="sm" loading={busy === "restart"} disabled={locked || vm.status !== "running"} onClick={() => power("restart")} title="Restart">
                <Icon name="refresh" size={13} />
              </Button>
              <Button size="sm" variant="danger" loading={busy === "stop"} disabled={locked || vm.status !== "running"} onClick={() => power("stop")} title="Shut down">
                <Icon name="stop" size={12} /> Stop
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
