"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, CardHeader, Field, Toggle } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { inputCls } from "@/lib/styles";
import type { PanelSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: PanelSettings }) {
  const { run, busy } = useRun();
  const [s, setS] = useState(initial);
  const set = <K extends keyof PanelSettings>(k: K, v: PanelSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const text = (k: keyof PanelSettings, label: string, hint?: string, mono = false) => (
    <Field label={label} hint={hint}>
      <input value={s[k] as string} onChange={(e) => set(k, e.target.value as never)} required className={`${inputCls} ${mono ? "font-mono" : ""}`} />
    </Field>
  );
  const num = (k: keyof PanelSettings, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" min={0} value={s[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} required className={inputCls} />
    </Field>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run("save", () => api("/api/admin/settings", "PUT", s), { success: "Settings saved" });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader title="General" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {text("panelName", "Panel name")}
          {text("nodeName", "Node name", "Shown in the sidebar", true)}
          {text("sshHost", "SSH host", "Shown in SSH connection strings, e.g. ssh.tuffnode.example", true)}
          <div className="flex items-center justify-between rounded-lg border border-line px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-white">Allow public registration</p>
              <p className="text-xs text-zinc-500">When off, only administrators can create accounts.</p>
            </div>
            <Toggle checked={s.allowRegistration} onChange={(v) => set("allowRegistration", v)} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Host capacity" subtitle="Physical resources available for allocation on this node" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {num("hostCpu", "CPU threads", "vCPUs may be overcommitted 2×")}
          {num("hostRamMb", "Memory (MB)")}
          {num("hostDiskGb", "Storage (GB)")}
        </div>
      </Card>

      <Card>
        <CardHeader title="Networking" subtitle="New VMs receive the next free address from this pool" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {text("bridge", "Bridge interface", undefined, true)}
          {text("subnetPrefix", "Subnet prefix (/24)", "e.g. 10.20.0 → 10.20.0.10–249, gateway .1", true)}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={busy === "save"}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
