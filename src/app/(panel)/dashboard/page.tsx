import { eq } from "drizzle-orm";
import { vms } from "@/db/schema";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CreateVmButton } from "@/components/CreateVmButton";
import { Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { VmCard } from "@/components/VmCard";
import { requireUser } from "@/lib/auth";
import { getEnabledTemplates } from "@/lib/data";
import { fmtMb } from "@/lib/format";
import { getAllocation, listVms } from "@/lib/vm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [list, usage, templates] = await Promise.all([
    listVms(eq(vms.ownerId, user.id)),
    getAllocation(user.id),
    getEnabledTemplates(),
  ]);

  const running = list.filter((v) => v.status === "running").length;
  const transitioning = list.some((v) => ["starting", "stopping", "installing"].includes(v.status));
  const canCreate = user.role === "admin" || usage.vms < user.maxVms;

  return (
    <>
      <AutoRefresh active={transitioning} />
      <PageHeader
        title="My Servers"
        subtitle={`${list.length} virtual machine${list.length === 1 ? "" : "s"} · ${running} running`}
        actions={<CreateVmButton templates={templates} defaultOwnerId={user.id} label="Deploy VM" />}
      />

      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Resource quota</h2>
          {!canCreate && <span className="text-xs text-amber-300">VM limit reached</span>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <ProgressBar label="Virtual machines" value={usage.vms} max={user.maxVms} detail={`${usage.vms} / ${user.maxVms}`} />
          <ProgressBar label="vCPU" value={usage.cpu} max={user.maxCpu} detail={`${usage.cpu} / ${user.maxCpu}`} />
          <ProgressBar label="Memory" value={usage.ramMb} max={user.maxRamMb} detail={`${fmtMb(usage.ramMb)} / ${fmtMb(user.maxRamMb)}`} />
          <ProgressBar label="Storage" value={usage.diskGb} max={user.maxDiskGb} detail={`${usage.diskGb} / ${user.maxDiskGb} GB`} />
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title="No virtual machines yet"
          description="Deploy your first VM from an OS template in under a minute."
          action={<CreateVmButton templates={templates} defaultOwnerId={user.id} label="Deploy your first VM" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((vm) => (
            <VmCard key={vm.id} vm={vm} />
          ))}
        </div>
      )}
    </>
  );
}
