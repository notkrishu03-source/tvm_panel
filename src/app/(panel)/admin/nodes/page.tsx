import { NodesManager } from "@/components/admin/NodesManager";
import { PageHeader } from "@/components/ui";
import { listNodes } from "@/lib/nodes";

export const dynamic = "force-dynamic";

export default async function AdminNodesPage() {
  const nodes = await listNodes();
  return (
    <>
      <PageHeader title="Nodes" subtitle="Physical hosts that run your virtual machines" />
      <NodesManager nodes={nodes} />
    </>
  );
}
