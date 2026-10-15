import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError, f, parseId, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: f.email.optional(),
  password: f.password.optional(),
  role: z.enum(["admin", "user"]).optional(),
  suspended: z.boolean().optional(),
  maxVms: z.number().int().min(0).max(1000).optional(),
  maxCpu: z.number().int().min(0).max(512).optional(),
  maxRamMb: z.number().int().min(0).max(4194304).optional(),
  maxDiskGb: z.number().int().min(0).max(100000).optional(),
});

async function otherAdminExists(excludeId: number) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.suspended, false), ne(users.id, excludeId)))
    .limit(1);
  return rows.length > 0;
}

export const PATCH = route<{ id: string }, typeof schema>(
  async ({ user, params, body }) => {
    const id = parseId(params.id);
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) throw new ApiError(404, "User not found");

    if (id === user.id && (body.role === "user" || body.suspended === true)) {
      throw new ApiError(400, "You cannot demote or suspend your own account");
    }
    if (
      target.role === "admin" &&
      (body.role === "user" || body.suspended === true) &&
      !(await otherAdminExists(id))
    ) {
      throw new ApiError(400, "At least one active administrator is required");
    }

    const { password, ...rest } = body;
    const values: Partial<typeof users.$inferInsert> = { ...rest };
    if (password) values.passwordHash = hashPassword(password);
    if (Object.keys(values).length === 0) return { ok: true };

    await db.update(users).set(values).where(eq(users.id, id));
    if (password || body.suspended) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }
    return { ok: true };
  },
  { admin: true, schema },
);

export const DELETE = route<{ id: string }>(
  async ({ user, params }) => {
    const id = parseId(params.id);
    if (id === user.id) throw new ApiError(400, "You cannot delete your own account");
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) throw new ApiError(404, "User not found");
    if (target.role === "admin" && !(await otherAdminExists(id))) {
      throw new ApiError(400, "At least one active administrator is required");
    }
    await db.delete(users).where(eq(users.id, id));
    return { ok: true };
  },
  { admin: true },
);
