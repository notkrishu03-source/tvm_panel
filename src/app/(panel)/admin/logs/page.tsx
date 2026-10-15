import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, vmLogs } from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const logs = await db
    .select({
      id: vmLogs.id,
      level: vmLogs.level,
      message: vmLogs.message,
      vmId: vmLogs.vmId,
      vmName: vmLogs.vmName,
      createdAt: vmLogs.createdAt,
      username: users.username,
    })
    .from(vmLogs)
    .leftJoin(users, eq(users.id, vmLogs.userId))
    .orderBy(desc(vmLogs.id))
    .limit(200);

  return (
    <>
      <PageHeader title="Activity" subtitle="The 200 most recent events across all virtual machines" />
      {logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">VM</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-zinc-500">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-xs uppercase ${l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-sky-400"}`}>{l.level}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {l.vmId ? (
                      <Link href={`/vms/${l.vmId}`} className="text-zinc-300 hover:text-brand-soft">
                        {l.vmName}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">{l.vmName ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{l.username ?? "system"}</td>
                  <td className="px-4 py-2.5 text-zinc-200">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
