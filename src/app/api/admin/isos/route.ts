import { z } from "zod";
import { db } from "@/db";
import { isos } from "@/db/schema";
import { ApiError, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  filename: z
    .string()
    .trim()
    .min(5)
    .max(160)
    .regex(/^[a-zA-Z0-9._-]+\.iso$/, "must be a file name ending in .iso"),
  sizeMb: z.number().int().min(1).max(100000),
});

export const POST = route(
  async ({ body }) => {
    const rows = await db.insert(isos).values(body).onConflictDoNothing().returning();
    if (rows.length === 0) throw new ApiError(409, "An ISO with this file name already exists");
    return { ok: true, id: rows[0].id };
  },
  { admin: true, schema },
);
