import { asc } from "drizzle-orm";
import { db } from "@/db";
import { osTemplates } from "@/db/schema";
import { TemplatesManager } from "@/components/admin/TemplatesManager";
import { PageHeader } from "@/components/ui";
import { getIsoList } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const [templates, isos] = await Promise.all([
    db
      .select({
        id: osTemplates.id,
        slug: osTemplates.slug,
        name: osTemplates.name,
        family: osTemplates.family,
        minDiskGb: osTemplates.minDiskGb,
        enabled: osTemplates.enabled,
      })
      .from(osTemplates)
      .orderBy(asc(osTemplates.family), asc(osTemplates.name)),
    getIsoList(),
  ]);

  return (
    <>
      <PageHeader title="Templates & ISOs" subtitle="Operating system images available to users" />
      <TemplatesManager templates={templates} isos={isos} />
    </>
  );
}
