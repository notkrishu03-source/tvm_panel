"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Badge, Button, Card, CardHeader, ConfirmModal, Field, Modal, ProgressBar } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtMb } from "@/lib/format";
import { inputCls } from "@/lib/styles";
import type { ClientNode } from "@/lib/nodes";

type Form = {
  name: string;
  hostname: string;
  location: string;
  cpuThreads: number;
  ramMb: number;
  diskGb: number;
  bridge: string;
  subnetPrefix: string;
  sshHost: string;
  status: "online" | "offline" | "maintenance";
};

const defaults: Form = {
  name: "",
  hostname: "",
  location: "",
  cpuThreads: 8,
  ramMb: 32768,
  diskGb: 500,
  bridge: "br0",
  subnetPrefix: "10.20.0",
  sshHost: "",
  status: "online",
};

export function NodesManager({ nodes }: { nodes: ClientNode[] }) {
  const { run, busy } = useRun();
  const [editing, setEditing] = useState<ClientNode | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClientNode | null>(null);
  const [form, setForm] = useState<Form>(defaults);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setForm(defaults);
    setError(null);
    setEditing("new");
  };
  const openEdit = (n: ClientNode) => {
    setForm({
      name: n.name,
      hostname: n.hostname,
      location: n.location ?? "",
      cpuThreads: n.cpuThreads,
      ramMb: n.ramMb,
      diskGb: n.diskGb,
      bridge: n.bridge,
      subnetPrefix: n.subnetPrefix,
      sshHost: n.sshHost,
      status: n.status,
    });
    setError(null);
    setEditing(n);
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing === "new") {
        await api("/api/admin/nodes", "POST", form);
      } else if (editing) {
        await api(`/api/admin/nodes/${editing.id}`, "PATCH", form);
      }
      const msg = editing === "new" ? "Node created" : "Node updated";
      setEditing(null);
      await run("noop", async () => undefined, { success: msg });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  const num = (k: keyof Form, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" min={0} value={form[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} required className={inputCls} />
    </Field>
  );
  const text = (k: keyof Form, label: string, hint?: string, mono = false) => (
    <Field label={label} hint={hint}>
      <input value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} required className={`${inputCls} ${mono ? "font-mono" : ""}`} />
    </Field>
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={openNew}>
          <Icon name="plus" size={16} /> Add node
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {nodes.map((n) => {
          const total = n.isDefault ? n.used : { cpu: 0, ramMb: 0, diskGb: 0, vms: 0 };
          return (
            <Card key={n.id} className={n.isDefault ? "border-brand/30" : ""}>
              <CardHeader
                title={n.name}
                subtitle={n.location || "No location"}
                action={n.isDefault && <Badge tone="orange">Default</Badge>}
              />
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${n.status === "online" ? "bg-emerald-400" : n.status === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
                    <span className="capitalize text-zinc-300">{n.status}</span>
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{n.hostname}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ["CPU", `${total.cpu}/${n.cpuThreads * 2}`],
                    ["RAM", `${fmtMb(total.ramMb)}/${fmtMb(n.ramMb)}`],
                    ["Disk", `${total.diskGb}/${n.diskGb} GB`],
                    ["VMs", String(total.vms)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-bg/60 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</dt>
                      <dd className="mt-0.5 text-xs font-medium tabular-nums text-zinc-100">{v}</dd>
                    </div>
                  ))}
                </div>

                {n.isDefault && (
                  <div className="space-y-3 border-t border-line pt-4">
                    <ProgressBar label="vCPU (2×)" value={total.cpu} max={n.cpuThreads * 2} detail={`${total.cpu} / ${n.cpuThreads * 2}`} />
                    <ProgressBar label="Memory" value={total.ramMb} max={n.ramMb} detail={`${fmtMb(total.ramMb)} / ${fmtMb(n.ramMb)}`} />
                    <ProgressBar label="Storage" value={total.diskGb} max={n.diskGb} detail={`${total.diskGb} / ${n.diskGb} GB`} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
                  <div>
                    <span className="block">Bridge</span>
                    <span className="font-mono text-zinc-300">{n.bridge}</span>
                  </div>
                  <div>
                    <span className="block">Subnet</span>
                    <span className="font-mono text-zinc-300">{n.subnetPrefix}.0/24</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block">SSH host</span>
                    <span className="font-mono text-zinc-300">{n.sshHost || "—"}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  {!n.isDefault && (
                    <Button size="sm" onClick={() => run("def", () => api(`/api/admin/nodes/${n.id}`, "PATCH", { setDefault: true }), { success: "Set as default" })}>
                      Set default
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openEdit(n)}>
                    Edit
                  </Button>
                  {!n.isDefault && (
                    <Button size="sm" variant="danger" onClick={() => setDeleting(n)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add node" : `Edit ${editing?.name ?? ""}`} width="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("name", "Node name")}
            {text("hostname", "Hostname / IP", undefined, true)}
            {text("location", "Location", "e.g. Atlanta, US-East")}
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={inputCls}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {num("cpuThreads", "CPU threads")}
            {num("ramMb", "RAM (MB)")}
            {num("diskGb", "Disk (GB)")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("bridge", "Bridge interface", undefined, true)}
            {text("subnetPrefix", "Subnet prefix", "e.g. 10.20.0", true)}
            {text("sshHost", "SSH host", "Public address shown in SSH commands", true)}
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy === "noop"}>
              {editing === "new" ? "Create node" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete node"
        confirmLabel="Delete node"
        requireText={deleting?.name}
        description={
          <>
            Node <strong>{deleting?.name}</strong> will be removed. VMs assigned to it will keep running but lose their node association.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return;
          await run("del", () => api(`/api/admin/nodes/${deleting.id}`, "DELETE"), { success: "Node deleted" });
          setDeleting(null);
        }}
      />
    </>
  );
}
