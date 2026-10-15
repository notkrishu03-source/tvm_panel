import { parseId, route } from "@/lib/api";
import { getAccessibleVm, listVmLogs } from "@/lib/vm";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const vm = await getAccessibleVm(parseId(params.id), user);
  const logs = await listVmLogs(vm.id);
  return { logs };
});
