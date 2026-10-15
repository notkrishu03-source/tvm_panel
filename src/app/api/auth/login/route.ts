import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; reset: number }>();

const schema = z.object({
  login: z.string().trim().min(1, "Enter your username or email").max(255),
  password: z.string().min(1, "Enter your password").max(128),
});

export const POST = route(
  async ({ req, body }) => {
    await ensureSeed();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `${ip}:${body.login.toLowerCase()}`;
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.reset > now && entry.count >= 8) {
      throw new ApiError(429, "Too many attempts, try again in a few minutes");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        sql`lower(${users.username}) = ${body.login.toLowerCase()} or ${users.email} = ${body.login.toLowerCase()}`,
      )
      .limit(1);

    const valid = user ? verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      attempts.set(key, {
        count: entry && entry.reset > now ? entry.count + 1 : 1,
        reset: entry && entry.reset > now ? entry.reset : now + 5 * 60_000,
      });
      throw new ApiError(401, "Invalid username or password");
    }
    if (user.suspended) throw new ApiError(403, "This account is suspended");

    attempts.delete(key);
    await createSession(user.id);
    return { ok: true, role: user.role };
  },
  { public: true, schema },
);
