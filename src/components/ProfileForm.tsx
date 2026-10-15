"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, CardHeader, Field } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { inputCls } from "@/lib/styles";

export function ProfileForm() {
  const { run, busy } = useRun();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) return setError("New passwords do not match");
    const res = await run("pw", () => api("/api/profile/password", "POST", { current, next }), {
      success: "Password updated",
    });
    if (res) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <Card>
      <CardHeader title="Change password" subtitle="Use at least 8 characters" />
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="Current password">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password">
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" loading={busy === "pw"}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
