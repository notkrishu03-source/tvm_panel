"use client";

import { useState } from "react";
import { LiveChart } from "@/components/LiveChart";
import { Card, CardHeader, CopyButton, ProgressBar } from "@/components/ui";
import { fmtDate, fmtMb, fmtRate, fmtUptime } from "@/lib/format";
import type { ClientVm, MetricSample } from "@/lib/vm";
import type { Metrics } from "@/components/vm/types";

function Tile({ label, value, sub, pct }: { label: string; value: string; sub: string; pct?: number }) {
  return (
    <div className="rounded-xl border border-line bg-panel/90 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
      {pct !== undefined && (
        <div className="mt-2.5">
          <ProgressBar value={pct} max={100} />
        </div>
      )}
    </div>
  );
}

export function OverviewTab({ vm, metrics, history }: { vm: ClientVm; metrics: Metrics | null; history: MetricSample[] }) {
  const [reveal, setReveal] = useState(false);
  const running = vm.status === "running";
  const cur = metrics?.current;
  const col = (pick: (s: MetricSample) => number) => history.map(pick);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="CPU usage" value={running ? `${cur?.cpu.toFixed(1) ?? "0.0"}%` : "—"} sub={`${vm.cpuCores} vCPU`} pct={running ? cur?.cpu : 0} />
        <Tile label="Memory" value={running ? fmtMb(cur?.memUsedMb ?? 0) : "—"} sub={`of ${fmtMb(vm.ramMb)} · ${running ? cur?.memPct.toFixed(0) : 0}%`} pct={running ? cur?.memPct : 0} />
        <Tile
          label="Disk"
          value={`${(metrics?.diskUsedGb ?? 0).toFixed(1)} GB`}
          sub={`of ${vm.diskGb} GB`}
          pct={metrics ? (metrics.diskUsedGb / vm.diskGb) * 100 : 0}
        />
        <Tile label="Uptime" value={running ? fmtUptime(metrics?.uptimeSec ?? 0) : "—"} sub={running ? "since last boot" : "powered off"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LiveChart
          title="CPU"
          max={100}
          offline={!running}
          series={[{ label: "usage", color: "#f97316", data: col((s) => s.cpu), current: running ? `${cur?.cpu.toFixed(1)}%` : "0%" }]}
        />
        <LiveChart
          title="Memory"
          max={100}
          offline={!running}
          series={[{ label: "used", color: "#a78bfa", data: col((s) => s.memPct), current: running ? `${cur?.memPct.toFixed(1)}%` : "0%" }]}
        />
        <LiveChart
          title="Network"
          offline={!running}
          series={[
            { label: "↓ in", color: "#34d399", data: col((s) => s.rxKbps), current: fmtRate(cur?.rxKbps ?? 0) },
            { label: "↑ out", color: "#38bdf8", data: col((s) => s.txKbps), current: fmtRate(cur?.txKbps ?? 0) },
          ]}
        />
        <LiveChart
          title="Disk I/O"
          offline={!running}
          series={[
            { label: "read", color: "#fbbf24", data: col((s) => s.readKbps), current: fmtRate(cur?.readKbps ?? 0) },
            { label: "write", color: "#f472b6", data: col((s) => s.writeKbps), current: fmtRate(cur?.writeKbps ?? 0) },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Connection" subtitle="Use these details to reach your VM" />
          <dl className="divide-y divide-line text-sm">
            <Row label="IPv4 address">
              <span className="font-mono text-zinc-100">{vm.ipv4}</span>
              <CopyButton value={vm.ipv4} />
            </Row>
            <Row label="Username">
              <span className="font-mono text-zinc-100">{vm.rootUsername}</span>
            </Row>
            <Row label="Password">
              <span className="font-mono text-zinc-100">{reveal ? vm.rootPassword : "•".repeat(12)}</span>
              <button onClick={() => setReveal((v) => !v)} className="rounded-md px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-white">
                {reveal ? "Hide" : "Show"}
              </button>
              <CopyButton value={vm.rootPassword} />
            </Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Specifications" />
          <dl className="divide-y divide-line text-sm">
            <Row label="Operating system"><span className="text-zinc-100">{vm.osName}</span></Row>
            <Row label="Resources">
              <span className="text-zinc-100">{vm.cpuCores} vCPU · {fmtMb(vm.ramMb)} RAM · {vm.diskGb} GB NVMe</span>
            </Row>
            <Row label="Boot media">
              <span className="text-zinc-100">{vm.isoName ? `ISO: ${vm.isoName}` : "Primary disk"}</span>
            </Row>
            <Row label="Created"><span className="text-zinc-100">{fmtDate(vm.createdAt)}</span></Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right">{children}</dd>
    </div>
  );
}
