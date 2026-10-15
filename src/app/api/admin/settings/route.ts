import { z } from "zod";
import { route } from "@/lib/api";
import { saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const schema = z.object({
  panelName: z.string().trim().min(2).max(40),
  nodeName: z.string().trim().min(2).max(40),
  allowRegistration: z.boolean(),
  hostCpu: z.number().int().min(1).max(1024),
  hostRamMb: z.number().int().min(1024).max(8388608),
  hostDiskGb: z.number().int().min(10).max(1000000),
  bridge: z.string().trim().min(1).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid bridge name"),
  subnetPrefix: z
    .string()
    .trim()
    .regex(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, "must look like 10.20.0")
    .refine((v) => v.split(".").every((p) => Number(p) <= 255), "octets must be 0-255"),
  sshHost: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/, "must be a valid hostname"),
  defaultMaxVms: z.number().int().min(0).max(1000),
  defaultMaxCpu: z.number().int().min(0).max(512),
  defaultMaxRamMb: z.number().int().min(0).max(4194304),
  defaultMaxDiskGb: z.number().int().min(0).max(100000),
});

export const PUT = route(
  async ({ body }) => {
    await saveSettings(
      Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])),
    );
    return { ok: true };
  },
  { admin: true, schema },
);
