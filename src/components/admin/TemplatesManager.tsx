"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { osFamilyOf, OsIcon } from "@/components/OsIcon";
import { Button, Card, CardHeader, Field, Modal, Toggle } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtMb } from "@/lib/format";
import { inputCls } from "@/lib/styles";

type Tpl = { id: number; slug: string; name: string; family: string; minDiskGb: number; enabled: boolean };
type Iso = { id: number; name: string; filename: string; sizeMb: number };

export function TemplatesManager({ templates, isos }: { templates: Tpl[]; isos: Iso[] }) {
  const { run, busy } = useRun();
  const [modal, setModal] = useState<"tpl" | "iso" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tpl, setTpl] = useState({ name: "", slug: "", family: "ubuntu", minDiskGb: 10 });
  const [iso, setIso] = useState({ name: "", filename: "", sizeMb: 700 });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (modal === "tpl") await api("/api/admin/templates", "POST", tpl);
      else await api("/api/admin/isos", "POST", iso);
      const kind = modal;
      setModal(null);
      if (kind === "tpl") setTpl({ name: "", slug: "", family: "ubuntu", minDiskGb: 10 });
      else setIso({ name: "", filename: "", sizeMb: 700 });
      await run("noop", async () => undefined, { success: kind === "tpl" ? "Template added" : "ISO added" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="OS templates"
          subtitle="Cloud images used for new VMs and reinstalls"
          action={
            <Button size="sm" variant="primary" onClick={() => { setError(null); setModal("tpl"); }}>
              <Icon name="plus" size={14} /> Add
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <OsIcon family={osFamilyOf(t.family)} size={34} />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${t.enabled ? "text-white" : "text-zinc-500"}`}>{t.name}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {t.slug} · min {t.minDiskGb} GB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={t.enabled}
                  disabled={busy === `t${t.id}`}
                  onChange={(v) => run(`t${t.id}`, () => api(`/api/admin/templates/${t.id}`, "PATCH", { enabled: v }), { success: v ? `${t.name} enabled` : `${t.name} disabled` })}
                />
                <button
                  onClick={() => run(`d${t.id}`, () => api(`/api/admin/templates/${t.id}`, "DELETE"), { success: "Template removed" })}
                  className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                  aria-label={`Delete ${t.name}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </li>
          ))}
          {templates.length === 0 && <li className="p-5 text-sm text-zinc-500">No templates yet.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="ISO library"
          subtitle="Images that can be attached to any VM"
          action={
            <Button size="sm" variant="primary" onClick={() => { setError(null); setModal("iso"); }}>
              <Icon name="plus" size={14} /> Add
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {isos.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-400">
                  <Icon name="disc" size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{i.name}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {i.filename} · {fmtMb(i.sizeMb)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => run(`i${i.id}`, () => api(`/api/admin/isos/${i.id}`, "DELETE"), { success: "ISO removed" })}
                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                aria-label={`Delete ${i.name}`}
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
          {isos.length === 0 && <li className="p-5 text-sm text-zinc-500">No ISO images yet.</li>}
        </ul>
      </Card>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === "tpl" ? "Add OS template" : "Add ISO image"}>
        <form onSubmit={submit} className="space-y-4">
          {modal === "tpl" ? (
            <>
              <Field label="Display name">
                <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} required minLength={2} maxLength={80} placeholder="Ubuntu 20.04 LTS" className={inputCls} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug" hint="Image file identifier">
                  <input value={tpl.slug} onChange={(e) => setTpl({ ...tpl, slug: e.target.value })} required placeholder="ubuntu-20.04" className={`${inputCls} font-mono`} />
                </Field>
                <Field label="Family">
                  <input value={tpl.family} onChange={(e) => setTpl({ ...tpl, family: e.target.value })} required list="families" className={inputCls} />
                  <datalist id="families">
                    {["ubuntu", "debian", "fedora", "centos", "almalinux", "rocky"].map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Minimum disk (GB)">
                <input type="number" min={1} max={500} value={tpl.minDiskGb} onChange={(e) => setTpl({ ...tpl, minDiskGb: Number(e.target.value) })} required className={inputCls} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Display name">
                <input value={iso.name} onChange={(e) => setIso({ ...iso, name: e.target.value })} required minLength={2} maxLength={80} placeholder="Arch Linux 2025.01" className={inputCls} />
              </Field>
              <Field label="File name" hint="Located in the node ISO directory">
                <input value={iso.filename} onChange={(e) => setIso({ ...iso, filename: e.target.value })} required placeholder="archlinux-2025.01.01-x86_64.iso" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Size (MB)">
                <input type="number" min={1} value={iso.sizeMb} onChange={(e) => setIso({ ...iso, sizeMb: Number(e.target.value) })} required className={inputCls} />
              </Field>
            </>
          )}
          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
