import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, vmLogs } from "@/db/schema";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, CardHeader, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { requireAdmin, verifyPassword } from "@/lib/auth";
import { fmtMb, timeAgo } from "@/lib/format";
import { DEFAULT_ADMIN_PASSWORD } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { getAllocation, listVms } from "@/lib/vm";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const [settings, alloc, allVms, [{ value: userCount }], recent, [self]] = await Promise.all([
    getSettings(),
    getAllocation(),
    listVms(),
    db.select({ value: count() }).from(users),
    db
      .select({
        id: vmLogs.id,
        message: vmLogs.message,
        level: vmLogs.level,
        vmName: vmLogs.vmName,
        vmId: vmLogs.vmId,
        createdAt: vmLogs.createdAt,
        username: users.username,
      })
      .from(vmLogs)
      .leftJoin(users, eq(users.id, vmLogs.userId))
      .orderBy(desc(vmLogs.id))
      .limit(8),
    db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, admin.id)),
  ]);

  const running = allVms.filter((v) => v.status === "running").length;
  const busy = allVms.some((v) => ["starting", "stopping", "installing"].includes(v.status));
  const usingDefaultPassword = self ? verifyPassword(DEFAULT_ADMIN_PASSWORD, self.hash) : false;

  return (
    <>
      <AutoRefresh active={busy} />
      <PageHeader title="Admin overview" subtitle={`Node ${settings.nodeName} · bridge ${settings.bridge} · ${settings.subnetPrefix}.0/24`} />

      {usingDefaultPassword && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>You are still using the default administrator password. Change it now.</span>
          <Link href="/profile" className="font-medium text-amber-100 underline underline-offset-2">
            Go to account
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Virtual machines" value={allVms.length} hint={`${running} running`} />
        <Stat label="Running" value={running} accent="text-emerald-400" hint={`${allVms.length - running} not running`} />
        <Stat label="Users" value={userCount} hint={settings.allowRegistration ? "registration open" : "registration closed"} />
        <Stat label="IP pool used" value={`${allVms.length} / 240`} hint={`${settings.subnetPrefix}.10 – .249`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Host capacity" subtitle="Allocated resources on this node" />
          <div className="space-y-5 p-5">
            <ProgressBar label="vCPU (2× overcommit)" value={alloc.cpu} max={settings.hostCpu * 2} detail={`${alloc.cpu} / ${settings.hostCpu * 2}`} />
            <ProgressBar label="Memory" value={alloc.ramMb} max={settings.hostRamMb} detail={`${fmtMb(alloc.ramMb)} / ${fmtMb(settings.hostRamMb)}`} />
            <ProgressBar label="Storage" value={alloc.diskGb} max={settings.hostDiskGb} detail={`${alloc.diskGb} / ${settings.hostDiskGb} GB`} />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent activity"
            action={
              <Link href="/admin/logs" className="text-xs text-brand hover:text-brand-soft">
                View all
              </Link>
            }
          />
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.level === "warn" ? "bg-amber-400" : l.level === "error" ? "bg-red-400" : "bg-sky-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-200">{l.message}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {l.vmName ? (
                        l.vmId ? (
                          <Link href={`/vms/${l.vmId}`} className="font-mono text-zinc-400 hover:text-brand-soft">
                            {l.vmName}
                          </Link>
                        ) : (
                          <span className="font-mono">{l.vmName}</span>
                        )
                      ) : (
                        "system"
                      )}{" "}
                      · {l.username ?? "system"} · {timeAgo(l.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
