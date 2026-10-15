"use client";

import { useState } from "react";
import Link from "next/link";
import { CreateVmButton } from "@/components/CreateVmButton";
import { Icon } from "@/components/Icon";
import { osFamilyOf, OsIcon } from "@/components/OsIcon";
import { Button, ConfirmModal, EmptyState, StatusBadge } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtMb } from "@/lib/format";
import { inputCls } from "@/lib/styles";
import type { ClientVm } from "@/lib/vm";

type Template = { id: number; name: string; family: string; minDiskGb: number };
type Owner = { id: number; username: string };

export function AdminVmTable({
  vms,
  templates,
  owners,
  adminId,
}: {
  vms: ClientVm[];
  templates: Template[];
  owners: Owner[];
  adminId: number;
}) {
  const { run, busy } = useRun();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<ClientVm | null>(null);

  const filtered = vms.filter((v) => {
    const text = `${v.name} ${v.ownerName} ${v.ipv4} ${v.osName}`.toLowerCase();
    return text.includes(q.toLowerCase()) && (status === "all" || v.status === status || (status === "suspended" && v.suspended));
  });

  const power = (vm: ClientVm, op: "start" | "stop") =>
    run(`${op}${vm.id}`, () => api(`/api/vms/${vm.id}/action`, "POST", { action: "power", op }), {
      success: op === "start" ? `Starting ${vm.name}…` : `Stopping ${vm.name}…`,
    });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, owner, IP or OS…" className={`${inputCls} max-w-xs`} aria-label="Search VMs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-auto`} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="installing">Installing</option>
          <option value="suspended">Suspended</option>
        </select>
        <div className="ml-auto">
          <CreateVmButton templates={templates} owners={owners} defaultOwnerId={adminId} label="New VM" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No virtual machines match" description="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel/90">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">VM</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Resources</th>
                <th className="px-4 py-3 font-medium">IPv4</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((vm) => {
                const locked = ["starting", "stopping", "installing"].includes(vm.status);
                return (
                  <tr key={vm.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/vms/${vm.id}`} className="flex items-center gap-3">
                        <OsIcon family={osFamilyOf(vm.osName)} size={32} />
                        <span>
                          <span className="block font-medium text-white hover:text-brand-soft">{vm.name}</span>
                          <span className="block text-xs text-zinc-500">{vm.osName}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{vm.ownerName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={vm.status} suspended={vm.suspended} />
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">
                      {vm.cpuCores} vCPU · {fmtMb(vm.ramMb)} · {vm.diskGb} GB
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{vm.ipv4}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {vm.status === "stopped" ? (
                          <Button size="sm" variant="success" loading={busy === `start${vm.id}`} disabled={locked} onClick={() => power(vm, "start")}>
                            <Icon name="play" size={11} /> Start
                          </Button>
                        ) : (
                          <Button size="sm" loading={busy === `stop${vm.id}`} disabled={locked || vm.status !== "running"} onClick={() => power(vm, "stop")}>
                            <Icon name="stop" size={11} /> Stop
                          </Button>
                        )}
                        <Link href={`/vms/${vm.id}`} className="inline-flex items-center rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600" aria-label={`Manage ${vm.name}`}>
                          Manage
                        </Link>
                        <Button size="sm" variant="danger" onClick={() => setTarget(vm)} aria-label={`Delete ${vm.name}`}>
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Delete virtual machine"
        confirmLabel="Delete forever"
        requireText={target?.name}
        description={
          <>
            <strong>{target?.name}</strong> owned by {target?.ownerName} will be destroyed, including its disk and IP lease.
          </>
        }
        onConfirm={async () => {
          if (!target) return;
          await run("del", () => api(`/api/vms/${target.id}`, "DELETE"), { success: `${target.name} deleted` });
          setTarget(null);
        }}
      />
    </>
  );
}
