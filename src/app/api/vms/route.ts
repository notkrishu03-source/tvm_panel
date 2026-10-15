import { z } from "zod";
import { eq } from "drizzle-orm";
import { vms } from "@/db/schema";
import { f, route } from "@/lib/api";
import { createVm, listVms } from "@/lib/vm";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: f.vmName,
  templateId: z.number().int().positive("Select an operating system"),
  cpuCores: z.number().int().min(1).max(32),
  ramMb: z.number().int().min(256).max(131072),
  diskGb: z.number().int().min(1).max(2000),
  password: f.password.optional(),
  ownerId: z.number().int().positive().optional(),
});

export const GET = route(async ({ req, user }) => {
  const all = new URL(req.url).searchParams.get("all") === "1" && user.role === "admin";
  const list = await listVms(all ? undefined : eq(vms.ownerId, user.id));
  return { vms: list };
});

export const POST = route(
  async ({ user, body }) => {
    const vm = await createVm({ ...body, ownerId: body.ownerId ?? user.id }, user);
    return { ok: true, id: vm.id };
  },
  { schema },
);
