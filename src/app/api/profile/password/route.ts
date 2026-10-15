import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, f, route } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: f.password,
});

export const POST = route(
  async ({ user, body }) => {
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    if (!row || !verifyPassword(body.current, row.passwordHash)) {
      throw new ApiError(400, "Current password is incorrect");
    }
    await db
      .update(users)
      .set({ passwordHash: hashPassword(body.next) })
      .where(eq(users.id, user.id));
    return { ok: true };
  },
  { schema },
);
