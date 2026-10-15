import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, f, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: f.username,
  email: f.email,
  password: f.password,
});

export const POST = route(
  async ({ body }) => {
    await ensureSeed();
    const s = await getSettings();
    if (!s.allowRegistration) throw new ApiError(403, "Registration is disabled");

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${body.username.toLowerCase()} or ${users.email} = ${body.email}`)
      .limit(1);
    if (existing) throw new ApiError(409, "Username or email is already in use");

    const [user] = await db
      .insert(users)
      .values({
        username: body.username,
        email: body.email,
        passwordHash: hashPassword(body.password),
        role: "user",
        maxVms: s.defaultMaxVms,
        maxCpu: s.defaultMaxCpu,
        maxRamMb: s.defaultMaxRamMb,
        maxDiskGb: s.defaultMaxDiskGb,
      })
      .returning({ id: users.id });

    await createSession(user.id);
    return { ok: true };
  },
  { public: true, schema },
);
