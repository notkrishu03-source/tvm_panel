import { z } from "zod";
import { route } from "@/lib/api";
import { createNode, listNodes } from "@/lib/nodes";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  hostname: z.string().trim().min(1).max(255),
  location: z.string().trim().max(80).optional().default(""),
  cpuThreads: z.number().int().min(1).max(1024),
  ramMb: z.number().int().min(1024).max(8388608),
  diskGb: z.number().int().min(10).max(1000000),
  bridge: z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid bridge name"),
  subnetPrefix: z
    .string()
    .trim()
    .regex(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, "must look like 10.20.0")
    .refine((v) => v.split(".").every((p) => Number(p) <= 255), "octets must be 0-255"),
  sshHost: z.string().trim().max(255).optional().default(""),
  status: z.enum(["online", "offline", "maintenance"]),
});

export const GET = route(async () => ({ nodes: await listNodes() }), { admin: true });

export const POST = route(async ({ body }) => ({ node: await createNode(body) }), { admin: true, schema });
