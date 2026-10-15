"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Card, CardHeader, ConfirmModal, Field, Modal } from "@/components/ui";
import { useRun } from "@/components/useRun";
import { api } from "@/lib/client-api";
import { fmtDate } from "@/lib/format";
import { inputCls } from "@/lib/styles";
import type { TabProps } from "@/components/vm/types";

type Entry = {
  id: number;
  path: string;
  name: string;
  type: "file" | "dir";
  size: number;
  createdAt: string;
};

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(name: string, type: "file" | "dir") {
  if (type === "dir") return "hdd";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "conf" || ext === "cfg" || ext === "ini" || ext === "env") return "settings";
  if (ext === "log" || ext === "txt" || ext === "md") return "list";
  if (ext === "sh" || ext === "bash") return "terminal";
  return "disc";
}

export function FilesTab({ vm }: TabProps) {
  const { run, busy } = useRun();
  const [dir, setDir] = useState("/");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [newEntryName, setNewEntryName] = useState("");
  const [viewing, setViewing] = useState<{ entry: Entry; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(
    async (d = dir) => {
      try {
        const res = await api<{ dir: string; entries: Entry[] }>(`/api/vms/${vm.id}/files?dir=${encodeURIComponent(d)}`);
        setEntries(res.entries);
        setDir(res.dir);
        setError(null);
        setSelected(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load directory");
      }
    },
    [vm.id, dir],
  );

  useEffect(() => {
    void load("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.id]);

  const navigate = (name: string) => {
    const next = dir === "/" ? `/${name}` : `${dir}/${name}`;
    void load(next);
  };
  const goUp = () => {
    if (dir === "/") return;
    const parts = dir.split("/").filter(Boolean);
    parts.pop();
    void load("/" + parts.join("/"));
  };

  const breadcrumbs = dir === "/" ? [""] : ["", ...dir.split("/").filter(Boolean)];

  async function createEntry() {
    if (!newEntryName.trim()) return;
    const res = await run("create", () =>
      api(`/api/vms/${vm.id}/files`, "POST", { dir, name: newEntryName.trim(), type: creating, content: creating === "file" ? "" : undefined }),
      { success: creating === "dir" ? "Folder created" : "File created", refresh: false },
    );
    if (res) {
      setCreating(null);
      setNewEntryName("");
      await load(dir);
    }
  }

  async function rename() {
    if (!editing || !newName.trim() || newName === editing.name) {
      setEditing(null);
      return;
    }
    const res = await run("rename", () =>
      api(`/api/vms/${vm.id}/files`, "PATCH", { dir, name: editing.name, newName: newName.trim() }),
      { success: "Renamed", refresh: false },
    );
    if (res) {
      setEditing(null);
      await load(dir);
    }
  }

  async function remove() {
    if (!deleting) return;
    await run("del", () => api(`/api/vms/${vm.id}/files?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(deleting.name)}`, "DELETE"), {
      success: "Deleted",
      refresh: false,
    });
    setDeleting(null);
    await load(dir);
  }

  async function openFile(entry: Entry) {
    try {
      const res = await api<{ entry: Entry; content: string }>(`/api/vms/${vm.id}/files?file=${encodeURIComponent((dir === "/" ? "" : dir) + "/" + entry.name)}`);
      setViewing({ entry, content: res.content });
      setEditContent(res.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open file");
    }
  }

  async function saveFile() {
    if (!viewing) return;
    const path = (dir === "/" ? "" : dir) + "/" + viewing.entry.name;
    await run("save", () => api(`/api/vms/${vm.id}/files`, "PATCH", { dir, name: viewing.entry.name, content: editContent }), {
      success: "File saved",
      refresh: false,
    });
    setViewing(null);
    await load(dir);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const text = await f.text();
        await api(`/api/vms/${vm.id}/files`, "POST", { dir, name: f.name, type: "file", content: text });
      }
      await load(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function download(entry: Entry) {
    // fetch content then trigger download
    const path = (dir === "/" ? "" : dir) + "/" + entry.name;
    api<{ entry: Entry; content: string }>(`/api/vms/${vm.id}/files?file=${encodeURIComponent(path)}`)
      .then((res) => {
        const blob = new Blob([res.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = entry.name;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Download failed"));
  }

  const sorted = (entries ?? []).slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="File manager"
          subtitle="Browse and edit files on the VM's virtual disk"
          action={
            <div className="flex gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600">
                <Icon name="plus" size={13} /> Upload
                <input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
              </label>
              <Button size="sm" onClick={() => { setCreating("dir"); setNewEntryName(""); }}>
                <Icon name="plus" size={13} /> Folder
              </Button>
              <Button size="sm" variant="primary" onClick={() => { setCreating("file"); setNewEntryName(""); }}>
                <Icon name="plus" size={13} /> File
              </Button>
            </div>
          }
        />

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-5 py-2.5 text-sm">
          <button onClick={() => void load("/")} className="rounded px-1.5 py-0.5 font-mono text-zinc-400 transition hover:bg-white/10 hover:text-white">
            /
          </button>
          {breadcrumbs.slice(1).map((part, i) => {
            const path = "/" + breadcrumbs.slice(1, i + 2).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <span className="text-zinc-700">/</span>
                <button onClick={() => void load(path)} className="rounded px-1.5 py-0.5 font-mono text-zinc-400 transition hover:bg-white/10 hover:text-white">
                  {part}
                </button>
              </span>
            );
          })}
          {dir !== "/" && (
            <button onClick={goUp} className="ml-auto rounded px-2 py-0.5 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-white">
              ↑ Up
            </button>
          )}
        </div>

        {error && <p className="px-5 py-3 text-sm text-red-300">{error}</p>}
        {entries === null && !error && <p className="px-5 py-6 text-sm text-zinc-500">Loading…</p>}

        {entries && entries.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">This folder is empty.</p>
        )}

        {entries && entries.length > 0 && (
          <ul className="divide-y divide-line">
            {sorted.map((e) => (
              <li
                key={e.id}
                className={`flex items-center gap-3 px-5 py-2.5 transition hover:bg-white/[0.02] ${selected?.id === e.id ? "bg-brand/5" : ""}`}
                onClick={() => setSelected(e)}
                onDoubleClick={() => (e.type === "dir" ? navigate(e.name) : void openFile(e))}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-400">
                  <Icon name={iconFor(e.name, e.type) as IconName} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{e.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {e.type === "dir" ? "Folder" : fmtSize(e.size)} · {fmtDate(e.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {e.type === "file" && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        void openFile(e);
                      }}
                      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                      title="Edit"
                    >
                      <Icon name="terminal" size={14} />
                    </button>
                  )}
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setEditing(e);
                      setNewName(e.name);
                    }}
                    className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                    title="Rename"
                  >
                    <Icon name="settings" size={14} />
                  </button>
                  {e.type === "file" && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        download(e);
                      }}
                      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                      title="Download"
                    >
                      <Icon name="external" size={14} />
                    </button>
                  )}
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDeleting(e);
                    }}
                    className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                    title="Delete"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                  {e.type === "dir" && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        navigate(e.name);
                      }}
                      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                      title="Open"
                    >
                      <Icon name="back" size={14} className="rotate-180" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={creating !== null} onClose={() => setCreating(null)} title={creating === "dir" ? "New folder" : "New file"} width="max-w-sm">
        <div className="space-y-4">
          <Field label={creating === "dir" ? "Folder name" : "File name"}>
            <input value={newEntryName} onChange={(e) => setNewEntryName(e.target.value)} autoFocus className={inputCls} onKeyDown={(e) => e.key === "Enter" && void createEntry()} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy === "create"} onClick={() => void createEntry()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Rename" width="max-w-sm">
        <div className="space-y-4">
          <Field label="New name">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus className={inputCls} onKeyDown={(e) => e.key === "Enter" && void rename()} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy === "rename"} onClick={() => void rename()}>
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete entry"
        confirmLabel="Delete"
        description={
          deleting?.type === "dir"
            ? `Folder "${deleting?.name}" and all of its contents will be removed.`
            : `File "${deleting?.name}" will be removed.`
        }
        onConfirm={remove}
      />

      {/* File viewer/editor */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.entry.name ?? ""} width="max-w-3xl">
        {viewing && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              {fmtSize(viewing.entry.size)} · {fmtDate(viewing.entry.createdAt)}
            </p>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-80 w-full resize-y rounded-lg border border-line bg-[#05060a] p-3 font-mono text-xs text-zinc-200 outline-none focus:border-brand/60"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy === "save"} onClick={() => void saveFile()}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
