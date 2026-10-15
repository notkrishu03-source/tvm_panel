"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { OsIcon } from "@/components/OsIcon";
import { Button, Field, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/client-api";
import { generatePassword } from "@/lib/format";
import { inputCls } from "@/lib/styles";

type Template = { id: number; name: string; family: string; minDiskGb: number };
type Owner = { id: number; username: string };

const presets = [
  { label: "Nano", cpu: 1, ram: 512, disk: 10 },
  { label: "Small", cpu: 1, ram: 1024, disk: 15 },
  { label: "Medium", cpu: 2, ram: 2048, disk: 25 },
  { label: "Large", cpu: 4, ram: 4096, disk: 50 },
  { label: "XL", cpu: 8, ram: 8192, disk: 100 },
];

const cpuOptions = [1, 2, 3, 4, 6, 8, 12, 16];
const ramOptions = [512, 1024, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 32768];

export function CreateVmButton({
  templates,
  owners,
  defaultOwnerId,
  label = "Create VM",
  variant = "primary",
}: {
  templates: Template[];
  owners?: Owner[];
  defaultOwnerId: number;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<number>(templates[0]?.id ?? 0);
  const [cpu, setCpu] = useState(2);
  const [ram, setRam] = useState(2048);
  const [disk, setDisk] = useState(25);
  const [password, setPassword] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [error, setError] = useState<string | null>(null);

  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  const minDisk = tpl?.minDiskGb ?? 1;

  const applyPreset = (p: (typeof presets)[number]) => {
    setCpu(p.cpu);
    setRam(p.ram);
    setDisk(Math.max(p.disk, minDisk));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ id: number }>("/api/vms", "POST", {
        name,
        templateId,
        cpuCores: cpu,
        ramMb: ram,
        diskGb: Math.max(disk, minDisk),
        password: password || undefined,
        ownerId: owners ? ownerId : undefined,
      });
      toast(`Deploying ${name}…`, "success");
      setOpen(false);
      setName("");
      setPassword("");
      router.push(`/vms/${res.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create VM");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /> {label}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Deploy a new virtual machine" width="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hostname" hint="Letters, numbers and dashes">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" placeholder="web-02" autoFocus className={inputCls} />
            </Field>
            {owners ? (
              <Field label="Owner">
                <select value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))} className={inputCls}>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.username}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Root password" hint="Leave empty to generate one">
                <div className="flex gap-2">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} placeholder="auto-generated" className={`${inputCls} font-mono`} />
                  <Button type="button" onClick={() => setPassword(generatePassword())} title="Generate">
                    <Icon name="refresh" size={15} />
                  </Button>
                </div>
              </Field>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">Operating system</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {templates.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    setTemplateId(t.id);
                    setDisk((d) => Math.max(d, t.minDiskGb));
                  }}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition ${
                    t.id === templateId ? "border-brand/60 bg-brand/10" : "border-line bg-bg/50 hover:border-zinc-600"
                  }`}
                >
                  <OsIcon family={t.family} size={30} />
                  <span className="min-w-0 text-xs font-medium leading-snug text-zinc-100">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Resources</span>
              <div className="flex gap-1">
                {presets.map((p) => (
                  <button type="button" key={p.label} onClick={() => applyPreset(p)} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:bg-brand/20 hover:text-brand-soft">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="vCPU">
                <select value={cpu} onChange={(e) => setCpu(Number(e.target.value))} className={inputCls}>
                  {cpuOptions.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === 1 ? "core" : "cores"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Memory">
                <select value={ram} onChange={(e) => setRam(Number(e.target.value))} className={inputCls}>
                  {ramOptions.map((r) => (
                    <option key={r} value={r}>
                      {r >= 1024 ? `${r / 1024} GB` : `${r} MB`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Disk (GB)" hint={`Min ${minDisk} GB`}>
                <input type="number" value={disk} onChange={(e) => setDisk(Number(e.target.value))} min={minDisk} max={2000} className={inputCls} />
              </Field>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!templates.length}>
              Deploy VM
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
