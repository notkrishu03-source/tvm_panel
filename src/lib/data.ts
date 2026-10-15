import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { isos, osTemplates } from "@/db/schema";

export type TemplateOption = { id: number; name: string; family: string; minDiskGb: number };

export async function getEnabledTemplates(): Promise<TemplateOption[]> {
  return db
    .select({
      id: osTemplates.id,
      name: osTemplates.name,
      family: osTemplates.family,
      minDiskGb: osTemplates.minDiskGb,
    })
    .from(osTemplates)
    .where(eq(osTemplates.enabled, true))
    .orderBy(asc(osTemplates.family), asc(osTemplates.name));
}

export async function getIsoList() {
  return db
    .select({ id: isos.id, name: isos.name, filename: isos.filename, sizeMb: isos.sizeMb })
    .from(isos)
    .orderBy(asc(isos.name));
}
