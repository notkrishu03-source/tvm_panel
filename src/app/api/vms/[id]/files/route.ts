import { z } from "zod";
import { ApiError, parseId, route } from "@/lib/api";
import { getAccessibleVm } from "@/lib/vm";
import {
  createEntry,
  deleteEntry,
  ensureFiles,
  listDir,
  readFile,
  renameEntry,
  writeFile,
} from "@/lib/files";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  dir: z.string().default("/"),
  name: z.string().min(1).max(255),
  type: z.enum(["file", "dir"]),
  content: z.string().max(200_000).optional(),
});

const updateSchema = z.object({
  dir: z.string().default("/"),
  name: z.string().min(1).max(255),
  newName: z.string().min(1).max(255).optional(),
  content: z.string().max(200_000).optional(),
});

export const GET = route<{ id: string }>(async ({ req, user, params }) => {
  const vm = await getAccessibleVm(parseId(params.id), user);
  await ensureFiles(vm.id, vm.osName);

  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  if (file) {
    const { entry, content } = await readFile(vm.id, file);
    return { entry, content };
  }
  const dir = url.searchParams.get("dir") ?? "/";
  const entries = await listDir(vm.id, dir);
  return { dir: dir === "" ? "/" : dir, entries };
});

export const POST = route<{ id: string }, typeof createSchema>(
  async ({ user, params, body }) => {
    const vm = await getAccessibleVm(parseId(params.id), user);
    await ensureFiles(vm.id, vm.osName);
    const entry = await createEntry(vm.id, body.dir, body.name, body.type, body.content ?? "");
    return { entry };
  },
  { schema: createSchema },
);

export const PATCH = route<{ id: string }, typeof updateSchema>(
  async ({ user, params, body }) => {
    const vm = await getAccessibleVm(parseId(params.id), user);
    await ensureFiles(vm.id, vm.osName);
    if (body.newName && body.newName !== body.name) {
      await renameEntry(vm.id, body.dir, body.name, body.newName);
    }
    if (body.content !== undefined) {
      const dir = body.dir === "/" ? "" : body.dir;
      const full = `${dir}/${body.newName ?? body.name}`.replace(/\/+/g, "/") || "/";
      await writeFile(vm.id, full, body.content);
    }
    return { ok: true };
  },
  { schema: updateSchema },
);

export const DELETE = route<{ id: string }>(async ({ req, user, params }) => {
  const vm = await getAccessibleVm(parseId(params.id), user);
  const url = new URL(req.url);
  const dir = url.searchParams.get("dir") ?? "/";
  const name = url.searchParams.get("name");
  if (!name) throw new ApiError(400, "name is required");
  await deleteEntry(vm.id, dir, name);
  return { ok: true };
});
