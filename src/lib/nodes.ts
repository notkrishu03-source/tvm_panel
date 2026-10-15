import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { nodes, vms } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export type NodeRow = typeof nodes.$inferSelect;
export type ClientNode = {
  id: number;
  name: string;
  hostname: string;
  location: string | null;
  cpuThreads: number;
  ramMb: number;
  diskGb: number;
  bridge: string;
  subnetPrefix: string;
  sshHost: string;
  status: "online" | "offline" | "maintenance";
  isDefault: boolean;
  createdAt: string;
  used: { cpu: number; ramMb: number; diskGb: number; vms: number };
};

export async function getNodeUsage(nodeId: number) {
  const [r] = await db
    .select({
      vms: sql<number>`count(*)::int`,
      cpu: sql<number>`coalesce(sum(${vms.cpuCores}), 0)::int`,
      ramMb: sql<number>`coalesce(sum(${vms.ramMb}), 0)::int`,
      diskGb: sql<number>`coalesce(sum(${vms.diskGb}), 0)::int`,
    })
    .from(vms)
    .where(eq(vms.nodeId, nodeId));
  return r;
}

export function toClientNode(n: NodeRow, used: { cpu: number; ramMb: number; diskGb: number; vms: number }): ClientNode {
  return {
    id: n.id,
    name: n.name,
    hostname: n.hostname,
    location: n.location,
    cpuThreads: n.cpuThreads,
    ramMb: n.ramMb,
    diskGb: n.diskGb,
    bridge: n.bridge,
    subnetPrefix: n.subnetPrefix,
    sshHost: n.sshHost,
    status: n.status as ClientNode["status"],
    isDefault: n.isDefault,
    createdAt: n.createdAt.toISOString(),
    used,
  };
}

/** Seeds from panel settings if no nodes exist yet. */
export async function ensureNodes() {
  const [{ value }] = await db.select({ value: sql<number>`count(*)::int` }).from(nodes);
  if (value > 0) return;
  const s = await getSettings();
  await db
    .insert(nodes)
    .values({
      name: s.nodeName,
      hostname: s.sshHost || "localhost",
      location: "Datacenter 1",
      cpuThreads: s.hostCpu,
      ramMb: s.hostRamMb,
      diskGb: s.hostDiskGb,
      bridge: s.bridge,
      subnetPrefix: s.subnetPrefix,
      sshHost: s.sshHost,
      isDefault: true,
    })
    .onConflictDoNothing();
}

export async function listNodes(): Promise<ClientNode[]> {
  await ensureNodes();
  const rows = await db.select().from(nodes).orderBy(asc(nodes.id));
  const total = await getAllocation();
  return rows.map((n) => toClientNode(n, n.isDefault ? total : { cpu: 0, ramMb: 0, diskGb: 0, vms: 0 }));
}

export async function getClientNode(id: number): Promise<ClientNode | null> {
  const rows = await listNodes();
  return rows.find((n) => n.id === id) ?? null;
}

async function getAllocation() {
  const [r] = await db
    .select({
      vms: sql<number>`count(*)::int`,
      cpu: sql<number>`coalesce(sum(${vms.cpuCores}), 0)::int`,
      ramMb: sql<number>`coalesce(sum(${vms.ramMb}), 0)::int`,
      diskGb: sql<number>`coalesce(sum(${vms.diskGb}), 0)::int`,
    })
    .from(vms);
  return r;
}

export type NodeInput = {
  name: string;
  hostname: string;
  location?: string;
  cpuThreads: number;
  ramMb: number;
  diskGb: number;
  bridge: string;
  subnetPrefix: string;
  sshHost: string;
  status: "online" | "offline" | "maintenance";
};

export async function createNode(input: NodeInput) {
  const [existing] = await db.select({ id: nodes.id }).from(nodes).where(eq(nodes.name, input.name));
  if (existing) throw new ApiError(409, "A node with this name already exists");
  const hasDefault = await db.select({ id: nodes.id }).from(nodes).where(eq(nodes.isDefault, true)).limit(1);
  const [row] = await db
    .insert(nodes)
    .values({ ...input, isDefault: hasDefault.length === 0 })
    .returning();
  return toClientNode(row, { cpu: 0, ramMb: 0, diskGb: 0, vms: 0 });
}

export async function updateNode(id: number, input: Partial<NodeInput>) {
  const [existing] = await db.select().from(nodes).where(eq(nodes.id, id));
  if (!existing) throw new ApiError(404, "Node not found");
  if (input.name !== undefined) {
    const [dup] = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.name, input.name), sql`${nodes.id} != ${id}`));
    if (dup) throw new ApiError(409, "A node with this name already exists");
  }
  const used = await getNodeUsageSafe(existing);
  const merged = { ...existing, ...input };
  const [row] = await db.update(nodes).set(merged).where(eq(nodes.id, id)).returning();
  return toClientNode(row, used);
}

async function getNodeUsageSafe(node: NodeRow) {
  if (node.isDefault) return getAllocation();
  return { cpu: 0, ramMb: 0, diskGb: 0, vms: 0 };
}

export async function setDefaultNode(id: number) {
  const [existing] = await db.select().from(nodes).where(eq(nodes.id, id));
  if (!existing) throw new ApiError(404, "Node not found");
  await db.update(nodes).set({ isDefault: false }).where(eq(nodes.isDefault, true));
  await db.update(nodes).set({ isDefault: true }).where(eq(nodes.id, id));
  return { ok: true };
}

export async function deleteNode(id: number) {
  const [node] = await db.select().from(nodes).where(eq(nodes.id, id));
  if (!node) throw new ApiError(404, "Node not found");
  if (node.isDefault) throw new ApiError(400, "Cannot delete the default node");
  const [vmCount] = await db
    .select({ id: vms.id })
    .from(vms)
    .where(eq(vms.nodeId, id))
    .limit(1);
  if (vmCount) throw new ApiError(409, "This node still has VMs assigned to it");
  await db.delete(nodes).where(eq(nodes.id, id));
  return { ok: true };
}
