import { Badge, Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMb } from "@/lib/format";
import { getAllocation } from "@/lib/vm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const usage = await getAllocation(user.id);

  return (
    <>
      <PageHeader title="Account" subtitle="Your profile, quota and security settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <dl className="divide-y divide-line text-sm">
            {[
              ["Username", user.username],
              ["Email", user.email],
              ["Member since", fmtDate(user.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="text-zinc-100">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="text-zinc-500">Role</dt>
              <dd>
                <Badge tone={user.role === "admin" ? "orange" : "zinc"}>{user.role}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Quota" subtitle="Limits set by the administrator" />
          <div className="space-y-4 p-5">
            <ProgressBar label="Virtual machines" value={usage.vms} max={user.maxVms} detail={`${usage.vms} / ${user.maxVms}`} />
            <ProgressBar label="vCPU" value={usage.cpu} max={user.maxCpu} detail={`${usage.cpu} / ${user.maxCpu}`} />
            <ProgressBar label="Memory" value={usage.ramMb} max={user.maxRamMb} detail={`${fmtMb(usage.ramMb)} / ${fmtMb(user.maxRamMb)}`} />
            <ProgressBar label="Storage" value={usage.diskGb} max={user.maxDiskGb} detail={`${usage.diskGb} / ${user.maxDiskGb} GB`} />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <ProfileForm />
        </div>
      </div>
    </>
  );
}
