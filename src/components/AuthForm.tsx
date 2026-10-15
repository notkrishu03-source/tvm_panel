"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client-api";
import { inputCls } from "@/lib/styles";

export function AuthForm({ mode, allowRegistration }: { mode: "login" | "register"; allowRegistration: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      if (!isLogin && data.password !== data.confirm) throw new Error("Passwords do not match");
      await api(
        isLogin ? "/api/auth/login" : "/api/auth/register",
        "POST",
        isLogin
          ? { login: data.login, password: data.password }
          : { username: data.username, email: data.email, password: data.password },
      );
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="tn-pop w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1.5 text-sm text-zinc-400">
        {isLogin ? "Sign in to manage your virtual machines." : "Get access to the TVM panel and deploy your first VM."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        {isLogin ? (
          <Field label="Username or email">
            <input name="login" required autoFocus autoComplete="username" className={inputCls} placeholder="admin" />
          </Field>
        ) : (
          <>
            <Field label="Username">
              <input name="username" required autoFocus autoComplete="username" minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" className={inputCls} placeholder="johndoe" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@example.com" />
            </Field>
          </>
        )}
        <Field label="Password">
          <input name="password" type="password" required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? "current-password" : "new-password"} className={inputCls} placeholder="••••••••" />
        </Field>
        {!isLogin && (
          <Field label="Confirm password">
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} placeholder="••••••••" />
          </Field>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" loading={busy} className="w-full py-2.5">
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        {isLogin ? (
          allowRegistration ? (
            <>
              No account yet?{" "}
              <Link href="/register" className="font-medium text-brand hover:text-brand-soft">
                Register
              </Link>
            </>
          ) : (
            "Registration is currently closed."
          )
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:text-brand-soft">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
