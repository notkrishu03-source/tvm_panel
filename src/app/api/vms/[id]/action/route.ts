import { z } from "zod";
import { ApiError, f, parseId, route } from "@/lib/api";
import {
  getAccessibleVm,
  powerAction,
  reinstallVm,
  renameVm,
  resizeDisk,
  setIso,
  setNetwork,
  setResources,
  setRootPassword,
  setSuspended,
} from "@/lib/vm";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("power"), op: z.enum(["start", "stop", "restart", "kill"]) }),
  z.object({
    action: z.literal("reinstall"),
    templateId: z.number().int().positive(),
    password: f.password.optional(),
  }),
  z.object({ action: z.literal("iso"), isoId: z.number().int().positive().nullable() }),
  z.object({ action: z.literal("resize"), diskGb: z.number().int().min(2).max(2000) }),
  z.object({ action: z.literal("password"), password: f.password }),
  z.object({ action: z.literal("rename"), name: f.vmName }),
  z.object({ action: z.literal("suspend"), suspended: z.boolean() }),
  z.object({
    action: z.literal("resources"),
    cpuCores: z.number().int().min(1).max(32),
    ramMb: z.number().int().min(256).max(131072),
  }),
  z.object({
    action: z.literal("network"),
    bridge: z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid bridge name"),
    vlan: z.number().int().min(1).max(4094).nullable(),
  }),
]);

export const POST = route<{ id: string }, typeof schema>(
  async ({ user, params, body }) => {
    const vm = await getAccessibleVm(parseId(params.id), user);

    switch (body.action) {
      case "power":
        await powerAction(vm, body.op, user);
        return { ok: true };
      case "reinstall": {
        const password = await reinstallVm(vm, body.templateId, body.password, user);
        return { ok: true, password };
      }
      case "iso":
        await setIso(vm, body.isoId, user);
        return { ok: true };
      case "resize":
        await resizeDisk(vm, body.diskGb, user);
        return { ok: true };
      case "password":
        await setRootPassword(vm, body.password, user);
        return { ok: true };
      case "rename":
        await renameVm(vm, body.name, user);
        return { ok: true };
      case "suspend":
        await setSuspended(vm, body.suspended, user);
        return { ok: true };
      case "resources":
        await setResources(vm, body.cpuCores, body.ramMb, user);
        return { ok: true };
      case "network":
        await setNetwork(vm, body.bridge, body.vlan, user);
        return { ok: true };
      default:
        throw new ApiError(400, "Unknown action");
    }
  },
  { schema },
);
