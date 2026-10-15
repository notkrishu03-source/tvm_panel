import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const settings = await getSettings();
  return (
    <AuthShell panelName={settings.panelName}>
      <AuthForm mode="login" allowRegistration={settings.allowRegistration} />
    </AuthShell>
  );
}
