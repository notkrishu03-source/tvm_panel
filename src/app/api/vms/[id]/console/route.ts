import { z } from "zod";
import { ApiError, parseId, route } from "@/lib/api";
import { getAccessibleVm, powerAction, runConsole } from "@/lib/vm";

export const dynamic = "force-dynamic";

const schema = z.object({ command: z.string().max(300) });

export const POST = route<{ id: string }, typeof schema>(
  async ({ user, params, body }) => {
    const vm = await getAccessibleVm(parseId(params.id), user);
    if (vm.status !== "running") throw new ApiError(409, "VM is not running");
    if (vm.suspended && user.role !== "admin") throw new ApiError(403, "VM is suspended");

    const result = runConsole(vm, body.command);
    if (result.action === "poweroff") await powerAction(vm, "stop", user);
    if (result.action === "reboot") await powerAction(vm, "restart", user);
    return result;
  },
  { schema },
);
