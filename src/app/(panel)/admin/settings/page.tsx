import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Panel settings" subtitle="Node capacity, networking and account defaults" />
      <SettingsForm initial={settings} />
    </>
  );
}
