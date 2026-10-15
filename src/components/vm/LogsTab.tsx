"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, CardHeader } from "@/components/ui";
import { api } from "@/lib/client-api";
import { fmtDate } from "@/lib/format";
import type { TabProps } from "@/components/vm/types";

type Log = { id: number; level: string; message: string; createdAt: string; username: string | null };

export function LogsTab({ vm }: TabProps) {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ logs: Log[] }>(`/api/vms/${vm.id}/logs`);
      setLogs(res.logs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load logs");
    }
  }, [vm.id]);

  useEffect(() => {
    // Fetch on mount and whenever the VM status changes (new events are logged).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, vm.status]);

  return (
    <Card>
      <CardHeader
        title="Activity log"
        subtitle="Power events, reinstalls, resizes and configuration changes"
        action={
          <Button size="sm" onClick={load}>
            <Icon name="refresh" size={13} /> Refresh
          </Button>
        }
      />
      {error && <p className="p-5 text-sm text-red-300">{error}</p>}
      {!error && logs === null && <p className="p-5 text-sm text-zinc-500">Loading…</p>}
      {logs && logs.length === 0 && <p className="p-5 text-sm text-zinc-500">No activity recorded yet.</p>}
      {logs && logs.length > 0 && (
        <ul className="divide-y divide-line font-mono text-xs">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3 px-5 py-2.5">
              <span className="w-40 shrink-0 text-zinc-600">{fmtDate(l.createdAt)}</span>
              <span className={`w-12 shrink-0 uppercase ${l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-sky-400"}`}>{l.level}</span>
              <span className="min-w-0 flex-1 break-words text-zinc-300">{l.message}</span>
              <span className="hidden shrink-0 text-zinc-600 sm:block">{l.username ?? "system"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
