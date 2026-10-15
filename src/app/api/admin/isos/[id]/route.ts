import { eq } from "drizzle-orm";
import { db } from "@/db";
import { isos } from "@/db/schema";
import { parseId, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const DELETE = route<{ id: string }>(
  async ({ params }) => {
    await db.delete(isos).where(eq(isos.id, parseId(params.id)));
    return { ok: true };
  },
  { admin: true },
);
