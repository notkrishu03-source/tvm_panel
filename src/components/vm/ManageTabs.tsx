"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { OsIcon } from "@/components/OsIcon";
import { Badge, Button, Card, CardHeader, ConfirmModal, CopyButton, Field, ProgressBar, Toggle } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { vmAction, type IsoOption, type Metrics, type TabProps, type TemplateOption } from "@/components/vm/types";
import { api } from "@/lib/client-api";
import { fmtMb, generatePassword } from "@/lib/format";
import { inputCls } from "@/lib/styles";

/* ------------------------------- Reinstall ------------------------------- */

export function ReinstallTab({ vm, reload, templates }: TabProps & { templates: TemplateOption[] }) {
  const { run, busy } = useRun();
  const [tplId, setTplId] = useState<number>(vm.templateId ?? templates[0]?.id ?? 0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const tpl = templates.find((t) => t.id === tplId);
  const tooSmall = tpl ? vm.diskGb < tpl.minDiskGb : false;

  return (
    <Card>
      <CardHeader title="Reinstall operating system" subtitle="Wipes the disk and provisions a fresh image via cloud-init" />
      <div className="space-y-5 p-5">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          All data on <strong>{vm.name}</strong> will be permanently erased. Currently installed: {vm.osName}.
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTplId(t.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                t.id === tplId ? "border-brand/60 bg-brand/10" : "border-line bg-bg/50 hover:border-zinc-600"
              }`}
            >
              <OsIcon family={t.family} />
              <span>
                <span className="block text-sm font-medium text-white">{t.name}</span>
                <span className="block text-xs text-zinc-500">min {t.minDiskGb} GB disk</span>
              </span>
            </button>
          ))}
        </div>

        <div className="max-w-md">
          <Field label="New root password" hint="Leave empty to generate a secure one">
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="auto-generated" className={`${inputCls} font-mono`} />
              <Button type="button" onClick={() => setPassword(generatePassword())}>
                <Icon name="refresh" size={15} />
              </Button>
            </div>
          </Field>
        </div>

        {tooSmall && <p className="text-sm text-red-300">{tpl?.name} needs at least {tpl?.minDiskGb} GB; this VM has {vm.diskGb} GB.</p>}

        {issued && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <span>
              Reinstall started. New root password: <span className="font-mono font-semibold">{issued}</span>
            </span>
            <CopyButton value={issued} />
          </div>
        )}

        <Button variant="danger" disabled={!tpl || tooSmall || vm.status === "installing"} onClick={() => setConfirm(true)}>
          <Icon name="refresh" size={15} /> Reinstall {tpl?.name ?? ""}
        </Button>
      </div>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm reinstall"
        confirmLabel={busy === "reinstall" ? "Starting…" : "Wipe & reinstall"}
        requireText={vm.name}
        description={
          <>
            This will erase <strong>{vm.name}</strong> and install <strong>{tpl?.name}</strong>. This cannot be undone.
          </>
        }
        onConfirm={async () => {
          const res = await run(
            "reinstall",
            () => vmAction<{ ok: boolean; password: string }>(vm.id, { action: "reinstall", templateId: tplId, password: password || undefined }),
            { success: "Reinstall started", refresh: false },
          );
          setConfirm(false);
          if (res) {
            setIssued(res.password);
            setPassword("");
            await reload();
          }
        }}
      />
    </Card>
  );
}

/* --------------------------------- Media --------------------------------- */

export function MediaTab({ vm, reload, isos }: TabProps & { isos: IsoOption[] }) {
  const { run, busy } = useRun();
  const act = (key: string, isoId: number | null, success: string) =>
    run(key, () => vmAction(vm.id, { action: "iso", isoId }), { success, refresh: false }).then(() => reload());

  return (
    <Card>
      <CardHeader
        title="ISO images"
        subtitle="Attach an installer or rescue ISO. The VM boots from it on the next start."
        action={
          vm.isoId ? (
            <Button size="sm" variant="danger" loading={busy === "eject"} onClick={() => act("eject", null, "ISO ejected")}>
              Eject
            </Button>
          ) : undefined
        }
      />
      {isos.length === 0 ? (
        <p className="p-5 text-sm text-zinc-500">No ISO images are available. An administrator can add some.</p>
      ) : (
        <ul className="divide-y divide-line">
          {isos.map((iso) => {
            const attached = vm.isoId === iso.id;
            return (
              <li key={iso.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-400">
                    <Icon name="disc" size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{iso.name}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">
                      {iso.filename} · {fmtMb(iso.sizeMb)}
                    </p>
                  </div>
                </div>
                {attached ? (
                  <Badge tone="orange">Attached</Badge>
                ) : (
                  <Button size="sm" loading={busy === `iso${iso.id}`} onClick={() => act(`iso${iso.id}`, iso.id, `${iso.name} attached`)}>
                    Attach
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------- Disk --------------------------------- */

export function DiskTab({ vm, reload, metrics, isAdmin }: TabProps & { metrics: Metrics | null }) {
  const { run, busy } = useRun();
  const [size, setSize] = useState(vm.diskGb + 10);
  const used = metrics?.diskUsedGb ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run("resize", () => vmAction(vm.id, { action: "resize", diskGb: size }), {
      success: `Disk grown to ${size} GB`,
      refresh: false,
    });
    await reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Storage" subtitle="Primary virtual disk (virtio-blk, qcow2)" />
        <div className="space-y-4 p-5">
          <p className="text-3xl font-semibold tabular-nums text-white">
            {vm.diskGb} <span className="text-base font-normal text-zinc-500">GB</span>
          </p>
          <ProgressBar label="Used" value={used} max={vm.diskGb} detail={`${used.toFixed(1)} GB / ${vm.diskGb} GB`} />
        </div>
      </Card>
      {isAdmin ? (
        <Card>
          <CardHeader title="Resize disk" subtitle="Disks can be grown online but never shrunk" />
          <form onSubmit={submit} className="space-y-4 p-5">
            <Field label="New size (GB)">
              <input type="number" min={vm.diskGb + 1} max={2000} value={size} onChange={(e) => setSize(Number(e.target.value))} className={inputCls} />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {[10, 25, 50, 100].map((n) => (
                <button type="button" key={n} onClick={() => setSize(vm.diskGb + n)} className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-brand/20 hover:text-brand-soft">
                  +{n} GB
                </button>
              ))}
            </div>
            <Button type="submit" variant="primary" loading={busy === "resize"} disabled={size <= vm.diskGb || vm.status === "installing"}>
              <Icon name="hdd" size={15} /> Grow to {size} GB
            </Button>
            <p className="text-xs text-zinc-500">After resizing, the guest filesystem expands automatically on next boot (cloud-init growpart).</p>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Resize disk" subtitle="Administrators only" />
          <div className="p-5 text-sm text-zinc-500">
            Disk growth is managed by an administrator. Contact support if you need more storage.
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------- Network -------------------------------- */

export function NetworkTab({ vm, reload, isAdmin }: TabProps) {
  const { run, busy } = useRun();
  const [bridge, setBridge] = useState(vm.bridge);
  const [vlan, setVlan] = useState(vm.vlan ? String(vm.vlan) : "");
  const rows: [string, string][] = [
    ["IPv4 address", `${vm.ipv4}/24`],
    ["Gateway", vm.gateway],
    ["DNS", "1.1.1.1, 8.8.8.8"],
    ["MAC address", vm.mac],
    ["NIC model", "virtio-net"],
    ["Bridge", vm.bridge],
    ["VLAN", vm.vlan ? String(vm.vlan) : "none"],
    ["SSH forward port", String(vm.sshPort)],
    ["VNC display port", String(vm.vncPort)],
  ];

  async function save(e: FormEvent) {
    e.preventDefault();
    await run("net", () => vmAction(vm.id, { action: "network", bridge, vlan: vlan ? Number(vlan) : null }), {
      success: "Network updated",
      refresh: false,
    });
    await reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Network configuration" subtitle="Static IPv4 assigned from the node pool" />
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="flex items-center gap-2 font-mono text-zinc-100">
                {v}
                {(k === "IPv4 address" || k === "MAC address") && <CopyButton value={v.replace("/24", "")} />}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      {isAdmin && (
        <Card>
          <CardHeader title="Bridge & VLAN" subtitle="Administrators only" />
          <form onSubmit={save} className="space-y-4 p-5">
            <Field label="Bridge interface">
              <input value={bridge} onChange={(e) => setBridge(e.target.value)} required maxLength={32} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="VLAN ID" hint="Leave empty for an untagged port (1–4094)">
              <input type="number" min={1} max={4094} value={vlan} onChange={(e) => setVlan(e.target.value)} className={inputCls} />
            </Field>
            <Button type="submit" variant="primary" loading={busy === "net"}>
              Save network
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------- Settings -------------------------------- */

export function SettingsTab({ vm, reload, isAdmin }: TabProps) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [name, setName] = useState(vm.name);
  const [password, setPassword] = useState("");
  const [cpu, setCpu] = useState(vm.cpuCores);
  const [ram, setRam] = useState(vm.ramMb);
  const [del, setDel] = useState(false);

  const submitName = async (e: FormEvent) => {
    e.preventDefault();
    await run("rename", () => vmAction(vm.id, { action: "rename", name }), { success: "VM renamed", refresh: false });
    await reload();
  };
  const submitPass = async (e: FormEvent) => {
    e.preventDefault();
    const res = await run("pass", () => vmAction(vm.id, { action: "password", password }), { success: "Root password updated", refresh: false });
    if (res) setPassword("");
    await reload();
  };
  const submitRes = async (e: FormEvent) => {
    e.preventDefault();
    await run("res", () => vmAction(vm.id, { action: "resources", cpuCores: cpu, ramMb: ram }), { success: "Resources updated", refresh: false });
    await reload();
  };
  const toggleSuspend = async (suspended: boolean) => {
    await run("suspend", () => vmAction(vm.id, { action: "suspend", suspended }), {
      success: suspended ? "VM suspended" : "VM unsuspended",
      refresh: false,
    });
    await reload();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Hostname" />
        <form onSubmit={submitName} className="space-y-4 p-5">
          <Field label="VM name">
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" className={inputCls} />
          </Field>
          <Button type="submit" loading={busy === "rename"} disabled={name === vm.name}>
            Rename
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Root password" subtitle="Applied through cloud-init on next boot" />
        <form onSubmit={submitPass} className="space-y-4 p-5">
          <Field label="New password">
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} placeholder="At least 8 characters" className={`${inputCls} font-mono`} />
              <Button type="button" onClick={() => setPassword(generatePassword())}>
                <Icon name="refresh" size={15} />
              </Button>
            </div>
          </Field>
          <Button type="submit" loading={busy === "pass"} disabled={password.length < 8}>
            <Icon name="lock" size={14} /> Update password
          </Button>
        </form>
      </Card>

      {isAdmin && (
        <>
          <Card>
            <CardHeader title="Resources" subtitle="Administrators only · VM must be stopped" />
            <form onSubmit={submitRes} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="vCPU cores">
                  <input type="number" min={1} max={32} value={cpu} onChange={(e) => setCpu(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Memory (MB)">
                  <input type="number" min={256} max={131072} step={256} value={ram} onChange={(e) => setRam(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
              <Button type="submit" loading={busy === "res"} disabled={vm.status !== "stopped" || (cpu === vm.cpuCores && ram === vm.ramMb)}>
                Apply resources
              </Button>
              {vm.status !== "stopped" && <p className="text-xs text-zinc-500">Power off the VM to edit resources.</p>}
            </form>
          </Card>

          <Card>
            <CardHeader title="Suspension" subtitle="Administrators only" />
            <div className="flex items-center justify-between gap-4 p-5">
              <p className="text-sm text-zinc-400">Suspending forces the VM off and blocks the owner from controlling it.</p>
              <Toggle checked={vm.suspended} disabled={busy === "suspend"} onChange={toggleSuspend} />
            </div>
          </Card>
        </>
      )}

      <Card className="border-red-500/25 lg:col-span-2">
        <CardHeader title="Danger zone" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-white">Delete this virtual machine</p>
            <p className="text-sm text-zinc-500">The disk, IP address and all data are destroyed immediately.</p>
          </div>
          <Button variant="danger" onClick={() => setDel(true)}>
            <Icon name="trash" size={15} /> Delete VM
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={del}
        onClose={() => setDel(false)}
        title="Delete virtual machine"
        confirmLabel="Delete forever"
        requireText={vm.name}
        description={
          <>
            <strong>{vm.name}</strong> ({vm.ipv4}) and its disk will be destroyed. This cannot be undone.
          </>
        }
        onConfirm={async () => {
          const res = await run("delete", () => api(`/api/vms/${vm.id}`, "DELETE"), { success: "VM deleted", refresh: false });
          setDel(false);
          if (res) {
            router.replace(isAdmin ? "/admin/vms" : "/dashboard");
            router.refresh();
          }
        }}
      />
    </div>
  );
}
