import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { vmFiles, vms } from "@/db/schema";
import { ApiError } from "@/lib/api";

export type FileEntry = {
  id: number;
  vmId: number;
  path: string;
  name: string;
  type: "file" | "dir";
  size: number;
  createdAt: string;
};

function toEntry(r: typeof vmFiles.$inferSelect): FileEntry {
  return {
    id: r.id,
    vmId: r.vmId,
    path: r.path,
    name: r.name,
    type: r.type === "dir" ? "dir" : "file",
    size: r.size,
    createdAt: r.createdAt.toISOString(),
  };
}

function normDir(dir: string): string {
  if (!dir || dir === "/") return "/";
  const cleaned = "/" + dir.split("/").filter(Boolean).join("/");
  return cleaned;
}

function safeName(name: string) {
  if (!name || name.length > 255) throw new ApiError(400, "Invalid name");
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
    throw new ApiError(400, "Invalid name");
  }
  return name;
}

export async function ensureFiles(vmId: number, osName: string) {
  const existing = await db.select({ id: vmFiles.id }).from(vmFiles).where(eq(vmFiles.vmId, vmId)).limit(1);
  if (existing.length > 0) return;

  const seed: { path: string; name: string; type: "file" | "dir"; size: number; content: string }[] = [
    { path: "/", name: "bin", type: "dir", size: 0, content: "" },
    { path: "/", name: "etc", type: "dir", size: 0, content: "" },
    { path: "/", name: "home", type: "dir", size: 0, content: "" },
    { path: "/", name: "tmp", type: "dir", size: 0, content: "" },
    { path: "/", name: "usr", type: "dir", size: 0, content: "" },
    { path: "/", name: "var", type: "dir", size: 0, content: "" },
    { path: "/", name: "README.txt", type: "file", size: 120, content: `Welcome to ${osName}.\nThis VM is managed by TuffNode TVM.\n` },
    { path: "/etc", name: "os-release", type: "file", size: 180, content: `PRETTY_NAME="${osName}"\nNAME="${osName.split(" ")[0]}"\n` },
    { path: "/etc", name: "passwd", type: "file", size: 96, content: "root:x:0:0:root:/root:/bin/bash\n" },
    { path: "/etc", name: "nginx", type: "dir", size: 0, content: "" },
    { path: "/etc/nginx", name: "nginx.conf", type: "file", size: 240, content: "user www-data;\nworker_processes auto;\npid /run/nginx.pid;\n" },
    { path: "/home", name: "root", type: "dir", size: 0, content: "" },
    { path: "/home/root", name: ".bashrc", type: "file", size: 64, content: "export PS1='\\u@\\h:\\w# '\n" },
    { path: "/var", name: "log", type: "dir", size: 0, content: "" },
    { path: "/var/log", name: "syslog", type: "file", size: 420, content: "Oct 15 14:00:01 kernel: Booting Linux\nOct 15 14:00:02 systemd[1]: Started system.\n" },
    { path: "/var/log", name: "auth.log", type: "file", size: 120, content: "Oct 15 14:00:05 sshd[123]: Accepted publickey for root\n" },
    { path: "/tmp", name: "scratchpad", type: "dir", size: 0, content: "" },
  ];

  await db.insert(vmFiles).values(seed.map((s) => ({ vmId, ...s })));
}

export async function listDir(vmId: number, dir: string): Promise<FileEntry[]> {
  const d = normDir(dir);
  const rows = await db
    .select()
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d)))
    .orderBy(vmFiles.type, vmFiles.name);
  return rows.map(toEntry);
}

export async function readFile(vmId: number, fullPath: string): Promise<{ entry: FileEntry; content: string }> {
  const parts = fullPath.split("/").filter(Boolean);
  const name = parts.pop();
  if (!name) throw new ApiError(400, "Invalid path");
  const dir = "/" + parts.join("/");
  const [row] = await db
    .select()
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, dir === "/" ? "/" : dir), eq(vmFiles.name, name)))
    .limit(1);
  if (!row) throw new ApiError(404, "File not found");
  if (row.type !== "file") throw new ApiError(400, "Not a file");
  return { entry: toEntry(row), content: row.content ?? "" };
}

export async function createEntry(
  vmId: number,
  dir: string,
  name: string,
  type: "file" | "dir",
  content = "",
) {
  safeName(name);
  const d = normDir(dir);
  const [dup] = await db
    .select({ id: vmFiles.id })
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d), eq(vmFiles.name, name)))
    .limit(1);
  if (dup) throw new ApiError(409, "An entry with this name already exists");

  const size = type === "file" ? Buffer.byteLength(content, "utf8") : 0;
  const [row] = await db
    .insert(vmFiles)
    .values({ vmId, path: d, name, type, size, content: type === "file" ? content : null })
    .returning();
  return toEntry(row);
}

export async function renameEntry(vmId: number, dir: string, name: string, newName: string) {
  safeName(name);
  safeName(newName);
  const d = normDir(dir);
  const [row] = await db
    .select()
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d), eq(vmFiles.name, name)))
    .limit(1);
  if (!row) throw new ApiError(404, "Entry not found");

  const [dup] = await db
    .select({ id: vmFiles.id })
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d), eq(vmFiles.name, newName)))
    .limit(1);
  if (dup) throw new ApiError(409, "An entry with this name already exists");

  // If renaming a directory, update child paths.
  if (row.type === "dir") {
    const oldFull = d === "/" ? `/${name}` : `${d}/${name}`;
    const newFull = d === "/" ? `/${newName}` : `${d}/${newName}`;
    const children = await db
      .select()
      .from(vmFiles)
      .where(and(eq(vmFiles.vmId, vmId), like(vmFiles.path, `${oldFull}%`)));
    for (const c of children) {
      const newPath = c.path.replace(oldFull, newFull);
      await db.update(vmFiles).set({ path: newPath }).where(eq(vmFiles.id, c.id));
    }
  }

  await db.update(vmFiles).set({ name: newName }).where(eq(vmFiles.id, row.id));
  return { ok: true };
}

export async function writeFile(vmId: number, fullPath: string, content: string) {
  const parts = fullPath.split("/").filter(Boolean);
  const name = parts.pop();
  if (!name) throw new ApiError(400, "Invalid path");
  const dir = "/" + parts.join("/");
  const d = parts.length === 0 ? "/" : dir;
  const [row] = await db
    .select()
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d), eq(vmFiles.name, name)))
    .limit(1);
  if (!row) throw new ApiError(404, "File not found");
  if (row.type !== "file") throw new ApiError(400, "Not a file");
  const size = Buffer.byteLength(content, "utf8");
  await db.update(vmFiles).set({ content, size }).where(eq(vmFiles.id, row.id));
  return { ok: true, size };
}

export async function deleteEntry(vmId: number, dir: string, name: string) {
  safeName(name);
  const d = normDir(dir);
  const [row] = await db
    .select()
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), eq(vmFiles.path, d), eq(vmFiles.name, name)))
    .limit(1);
  if (!row) throw new ApiError(404, "Entry not found");

  const full = d === "/" ? `/${name}` : `${d}/${name}`;
  // delete children first
  const children = await db
    .select({ id: vmFiles.id })
    .from(vmFiles)
    .where(and(eq(vmFiles.vmId, vmId), like(vmFiles.path, `${full}%`)));
  for (const c of children) {
    await db.delete(vmFiles).where(eq(vmFiles.id, c.id));
  }
  await db.delete(vmFiles).where(eq(vmFiles.id, row.id));
  return { ok: true };
}

export async function deleteAllForVm(vmId: number) {
  await db.delete(vmFiles).where(eq(vmFiles.vmId, vmId));
}
// keep vms import used
void vms;
