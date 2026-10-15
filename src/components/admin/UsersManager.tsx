"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Badge, Button, ConfirmModal, Field, Modal, Toggle } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtMb, generatePassword, timeAgo } from "@/lib/format";
import { inputCls } from "@/lib/styles";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  suspended: boolean;
  maxVms: number;
  maxCpu: number;
  maxRamMb: number;
  maxDiskGb: number;
  createdAt: string;
  vmCount: number;
};

type Defaults = { maxVms: number; maxCpu: number; maxRamMb: number; maxDiskGb: number };

type Form = {
  username: string;
  email: string;
  password: string;
  role: "admin" | "user";
  suspended: boolean;
  maxVms: number;
  maxCpu: number;
  maxRamMb: number;
  maxDiskGb: number;
};

export function UsersManager({ users, defaults, currentUserId }: { users: UserRow[]; defaults: Defaults; currentUserId: number }) {
  const { run, busy } = useRun();
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [form, setForm] = useState<Form>({ username: "", email: "", password: "", role: "user", suspended: false, ...defaults });
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setForm({ username: "", email: "", password: generatePassword(), role: "user", suspended: false, ...defaults });
    setError(null);
    setEditing("new");
  };
  const openEdit = (u: UserRow) => {
    setForm({ username: u.username, email: u.email, password: "", role: u.role, suspended: u.suspended, maxVms: u.maxVms, maxCpu: u.maxCpu, maxRamMb: u.maxRamMb, maxDiskGb: u.maxDiskGb });
    setError(null);
    setEditing(u);
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const quotas = { maxVms: form.maxVms, maxCpu: form.maxCpu, maxRamMb: form.maxRamMb, maxDiskGb: form.maxDiskGb };
    try {
      if (editing === "new") {
        await api("/api/admin/users", "POST", { username: form.username, email: form.email, password: form.password, role: form.role, ...quotas });
      } else if (editing) {
        await api(`/api/admin/users/${editing.id}`, "PATCH", {
          email: form.email,
          role: form.role,
          suspended: form.suspended,
          password: form.password || undefined,
          ...quotas,
        });
      }
      setEditing(null);
      await run("noop", async () => undefined, { success: editing === "new" ? "User created" : "User updated" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  const num = (k: keyof Form, label: string, step = 1) => (
    <Field label={label}>
      <input type="number" min={0} step={step} value={form[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} className={inputCls} required />
    </Field>
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={openNew}>
          <Icon name="plus" size={16} /> New user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel/90">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">VMs</th>
              <th className="px-4 py-3 font-medium">Quota</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold uppercase text-zinc-200">{u.username.slice(0, 1)}</span>
                    <span>
                      <span className="block font-medium text-white">
                        {u.username} {u.id === currentUserId && <span className="text-xs text-zinc-500">(you)</span>}
                      </span>
                      <span className="block text-xs text-zinc-500">{u.email}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.role === "admin" ? "orange" : "zinc"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3">{u.suspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-300">
                  {u.vmCount} / {u.maxVms}
                </td>
                <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">
                  {u.maxCpu} vCPU · {fmtMb(u.maxRamMb)} · {u.maxDiskGb} GB
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" disabled={u.id === currentUserId} onClick={() => setDeleting(u)} aria-label={`Delete ${u.username}`}>
                      <Icon name="trash" size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Create user" : `Edit ${editing?.username ?? ""}`} width="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input value={form.username} onChange={(e) => set("username", e.target.value)} disabled={editing !== "new"} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className={inputCls} />
            </Field>
            <Field label={editing === "new" ? "Password" : "New password"} hint={editing === "new" ? undefined : "Leave empty to keep the current one"}>
              <input value={form.password} onChange={(e) => set("password", e.target.value)} required={editing === "new"} minLength={8} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => set("role", e.target.value as "admin" | "user")} className={inputCls}>
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>
            </Field>
          </div>
          {editing !== "new" && (
            <div className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Suspend account</p>
                <p className="text-xs text-zinc-500">Blocks sign-in and ends active sessions.</p>
              </div>
              <Toggle checked={form.suspended} onChange={(v) => set("suspended", v)} />
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy === "noop"}>
              {editing === "new" ? "Create user" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete user"
        confirmLabel="Delete user"
        requireText={deleting?.username}
        description={
          <>
            <strong>{deleting?.username}</strong> and all of their {deleting?.vmCount ?? 0} virtual machine(s) will be permanently deleted.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return;
          await run("del", () => api(`/api/admin/users/${deleting.id}`, "DELETE"), { success: "User deleted" });
          setDeleting(null);
        }}
      />
    </>
  );
}
