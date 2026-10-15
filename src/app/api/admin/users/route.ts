import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, f, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: f.username,
  email: f.email,
  password: f.password,
  role: z.enum(["admin", "user"]),
  maxVms: z.number().int().min(0).max(1000),
  maxCpu: z.number().int().min(0).max(512),
  maxRamMb: z.number().int().min(0).max(4194304),
  maxDiskGb: z.number().int().min(0).max(100000),
});

export const POST = route(
  async ({ body }) => {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${body.username.toLowerCase()} or ${users.email} = ${body.email}`)
      .limit(1);
    if (existing) throw new ApiError(409, "Username or email is already in use");

    const { password, ...rest } = body;
    const [user] = await db
      .insert(users)
      .values({ ...rest, passwordHash: hashPassword(password) })
      .returning({ id: users.id });
    return { ok: true, id: user.id };
  },
  { admin: true, schema },
);
