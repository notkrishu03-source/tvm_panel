import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { osTemplates } from "@/db/schema";
import { ApiError, parseId, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  minDiskGb: z.number().int().min(1).max(500).optional(),
});

export const PATCH = route<{ id: string }, typeof schema>(
  async ({ params, body }) => {
    const rows = await db
      .update(osTemplates)
      .set(body)
      .where(eq(osTemplates.id, parseId(params.id)))
      .returning({ id: osTemplates.id });
    if (rows.length === 0) throw new ApiError(404, "Template not found");
    return { ok: true };
  },
  { admin: true, schema },
);

export const DELETE = route<{ id: string }>(
  async ({ params }) => {
    await db.delete(osTemplates).where(eq(osTemplates.id, parseId(params.id)));
    return { ok: true };
  },
  { admin: true },
);
