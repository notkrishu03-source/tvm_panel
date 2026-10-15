import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const settings = await getSettings();
  return (
    <AuthShell panelName={settings.panelName}>
      {settings.allowRegistration ? (
        <AuthForm mode="register" allowRegistration />
      ) : (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-white">Registration closed</h1>
          <p className="mt-2 text-sm text-zinc-400">New accounts are created by an administrator.</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-soft">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
