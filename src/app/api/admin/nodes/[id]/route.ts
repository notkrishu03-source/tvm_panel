import { z } from "zod";
import { parseId, route } from "@/lib/api";
import { deleteNode, getClientNode, setDefaultNode, updateNode } from "@/lib/nodes";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    hostname: z.string().trim().min(1).max(255).optional(),
    location: z.string().trim().max(80).optional(),
    cpuThreads: z.number().int().min(1).max(1024).optional(),
    ramMb: z.number().int().min(1024).max(8388608).optional(),
    diskGb: z.number().int().min(10).max(1000000).optional(),
    bridge: z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid bridge name").optional(),
    subnetPrefix: z
      .string()
      .trim()
      .regex(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, "must look like 10.20.0")
      .refine((v) => v.split(".").every((p) => Number(p) <= 255), "octets must be 0-255")
      .optional(),
    sshHost: z.string().trim().max(255).optional(),
    status: z.enum(["online", "offline", "maintenance"]).optional(),
    setDefault: z.boolean().optional(),
  })
  .strict();

export const GET = route<{ id: string }>(async ({ params }) => {
  const node = await getClientNode(parseId(params.id));
  if (!node) throw new Error("Node not found");
  return { node };
}, { admin: true });

export const PATCH = route<{ id: string }, typeof schema>(
  async ({ params, body }) => {
    const id = parseId(params.id);
    if (body.setDefault) {
      await setDefaultNode(id);
      return { ok: true };
    }
    return { node: await updateNode(id, body) };
  },
  { admin: true, schema },
);

export const DELETE = route<{ id: string }>(
  async ({ params }) => {
    await deleteNode(parseId(params.id));
    return { ok: true };
  },
  { admin: true },
);
