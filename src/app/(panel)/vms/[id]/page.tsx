import { notFound } from "next/navigation";
import { VmDetail } from "@/components/vm/VmDetail";
import { requireUser } from "@/lib/auth";
import { getEnabledTemplates, getIsoList } from "@/lib/data";
import { getClientVm } from "@/lib/vm";

export const dynamic = "force-dynamic";

export default async function VmPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const vmId = Number(id);
  if (!Number.isInteger(vmId) || vmId <= 0) notFound();

  const vm = await getClientVm(vmId);
  if (!vm || (vm.ownerId !== user.id && user.role !== "admin")) notFound();

  const [templates, isos] = await Promise.all([getEnabledTemplates(), getIsoList()]);

  return (
    <VmDetail
      initialVm={vm}
      templates={templates}
      isos={isos}
      isAdmin={user.role === "admin"}
      viewerId={user.id}
    />
  );
}
