import { parseId, route } from "@/lib/api";
import { deleteVm, getAccessibleVm, metricsFor } from "@/lib/vm";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ req, user, params }) => {
  const vm = await getAccessibleVm(parseId(params.id), user);
  const history = new URL(req.url).searchParams.get("history") === "1";
  return { vm, metrics: metricsFor(vm, history) };
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const vm = await getAccessibleVm(parseId(params.id), user);
  await deleteVm(vm, user);
  return { ok: true };
});
