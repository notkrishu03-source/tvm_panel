import { z } from "zod";
import { db } from "@/db";
import { osTemplates } from "@/db/schema";
import { ApiError, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/, "may only contain lowercase letters, numbers, dots and dashes"),
  family: z.string().trim().toLowerCase().min(2).max(32),
  minDiskGb: z.number().int().min(1).max(500),
});

export const POST = route(
  async ({ body }) => {
    const rows = await db.insert(osTemplates).values(body).onConflictDoNothing().returning();
    if (rows.length === 0) throw new ApiError(409, "A template with this slug already exists");
    return { ok: true, id: rows[0].id };
  },
  { admin: true, schema },
);
