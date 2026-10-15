import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

export const SESSION_COOKIE = "tn_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  maxVms: number;
  maxCpu: number;
  maxRamMb: number;
  maxDiskGb: number;
  suspended: boolean;
  createdAt: Date;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt });

  const h = await headers();
  const https = h.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    expires: expiresAt,
    // Preview environments may embed the app in a cross-site iframe.
    sameSite: https ? "none" : "lax",
    secure: https,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  await ensureSeed();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      maxVms: users.maxVms,
      maxCpu: users.maxCpu,
      maxRamMb: users.maxRamMb,
      maxDiskGb: users.maxDiskGb,
      suspended: users.suspended,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row || row.suspended) return null;
  return { ...row, role: row.role === "admin" ? "admin" : "user" };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
