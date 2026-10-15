import "server-only";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { isos, osTemplates, users, vmLogs, vms } from "@/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * TuffNode VM engine.
 *
 * Everything here is driven by PostgreSQL state. To control real QEMU/KVM guests,
 * replace the `// driver:` hooks (power transitions, reinstall, disk resize) with
 * calls to libvirt / `qemu-system-x86_64` while keeping the same data model.
 */

export type VmStatus = "running" | "stopped" | "starting" | "stopping" | "installing";
export type VmRow = typeof vms.$inferSelect;

export type ClientVm = {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  osName: string;
  templateId: number | null;
  status: VmStatus;
  suspended: boolean;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  ipv4: string;
  gateway: string;
  mac: string;
  bridge: string;
  vlan: number | null;
  rootUsername: string;
  rootPassword: string;
  isoId: number | null;
  isoName: string | null;
  /** Public SSH host shown in connection strings */
  sshHost: string;
  /** SSH port forwarded to the VM's SSH daemon */
  sshPort: number;
  vncPort: number;
  startedAt: string | null;
  createdAt: string;
};

export function toClientVm(vm: VmRow, ownerName: string, isoName: string | null): ClientVm {
  return {
    id: vm.id,
    name: vm.name,
    ownerId: vm.ownerId,
    ownerName,
    osName: vm.osName,
    templateId: vm.templateId,
    status: vm.status as VmStatus,
    suspended: vm.suspended,
    cpuCores: vm.cpuCores,
    ramMb: vm.ramMb,
    diskGb: vm.diskGb,
    ipv4: vm.ipv4,
    gateway: vm.gateway,
    mac: vm.mac,
    bridge: vm.bridge,
    vlan: vm.vlan,
    rootUsername: vm.rootUsername,
    rootPassword: vm.rootPassword,
    isoId: vm.isoId,
    isoName,
    sshHost: "ssh.tuffnode.local",
    sshPort: 22000 + vm.id,
    vncPort: 5900 + vm.id,
    startedAt: vm.startedAt ? vm.startedAt.toISOString() : null,
    createdAt: vm.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Logging                                                             */
/* ------------------------------------------------------------------ */

export async function addLog(
  vm: { id: number | null; name: string } | null,
  userId: number | null,
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  await db.insert(vmLogs).values({
    vmId: vm?.id ?? null,
    vmName: vm?.name ?? null,
    userId,
    level,
    message,
  });
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Settles power / install transitions whose timer has elapsed. */
async function resolveTransition(vm: VmRow): Promise<VmRow> {
  if (!vm.transitionTo || !vm.transitionUntil) return vm;
  if (vm.transitionUntil.getTime() > Date.now()) return vm;

  const to = vm.transitionTo;
  const [updated] = await db
    .update(vms)
    .set({
      status: to,
      transitionTo: null,
      transitionUntil: null,
      startedAt: to === "running" ? vm.transitionUntil : null,
    })
    .where(sql`${vms.id} = ${vm.id} and ${vms.transitionTo} = ${to}`)
    .returning();

  if (updated) {
    if (vm.status === "installing") {
      await addLog(vm, null, `Installation of ${vm.osName} finished, VM is online`);
    }
    return updated;
  }
  const [fresh] = await db.select().from(vms).where(eq(vms.id, vm.id));
  return fresh ?? vm;
}

export async function listVms(where?: SQL): Promise<ClientVm[]> {
  const [rows, panelSettings] = await Promise.all([
    db
      .select({ vm: vms, ownerName: users.username, isoName: isos.name })
      .from(vms)
      .innerJoin(users, eq(users.id, vms.ownerId))
      .leftJoin(isos, eq(isos.id, vms.isoId))
      .where(where)
      .orderBy(desc(vms.createdAt)),
    getSettings(),
  ]);
  const resolved = await Promise.all(
    rows.map(async (r) => {
      const vm = await resolveTransition(r.vm);
      const client = toClientVm(vm, r.ownerName, r.isoName);
      client.sshHost = panelSettings.sshHost;
      return client;
    }),
  );
  return resolved;
}

export async function getClientVm(id: number): Promise<ClientVm | null> {
  const [vm] = await listVms(eq(vms.id, id));
  return vm ?? null;
}

export async function getAccessibleVm(id: number, user: SessionUser): Promise<ClientVm> {
  const vm = await getClientVm(id);
  if (!vm || (vm.ownerId !== user.id && user.role !== "admin")) {
    throw new ApiError(404, "VM not found");
  }
  return vm;
}

export async function getAllocation(ownerId?: number) {
  const [r] = await db
    .select({
      vms: sql<number>`count(*)::int`,
      cpu: sql<number>`coalesce(sum(${vms.cpuCores}), 0)::int`,
      ramMb: sql<number>`coalesce(sum(${vms.ramMb}), 0)::int`,
      diskGb: sql<number>`coalesce(sum(${vms.diskGb}), 0)::int`,
    })
    .from(vms)
    .where(ownerId ? eq(vms.ownerId, ownerId) : undefined);
  return r;
}

/* ------------------------------------------------------------------ */
/* Guards & capacity                                                   */
/* ------------------------------------------------------------------ */

function assertControllable(vm: ClientVm, actor: SessionUser) {
  if (vm.status === "installing") throw new ApiError(409, "VM is busy installing an OS");
  if (vm.suspended && actor.role !== "admin") {
    throw new ApiError(403, "This VM is suspended by an administrator");
  }
}

type Quota = { maxVms: number; maxCpu: number; maxRamMb: number; maxDiskGb: number; role: string };

async function assertCapacity(
  owner: Quota & { id: number },
  delta: { vms?: number; cpu?: number; ramMb?: number; diskGb?: number },
) {
  const [mine, host, s] = await Promise.all([
    getAllocation(owner.id),
    getAllocation(),
    getSettings(),
  ]);
  if (owner.role !== "admin") {
    if (mine.vms + (delta.vms ?? 0) > owner.maxVms)
      throw new ApiError(403, `VM limit reached (${owner.maxVms} per account)`);
    if (mine.cpu + (delta.cpu ?? 0) > owner.maxCpu)
      throw new ApiError(403, `vCPU quota exceeded (${owner.maxCpu} cores)`);
    if (mine.ramMb + (delta.ramMb ?? 0) > owner.maxRamMb)
      throw new ApiError(403, `RAM quota exceeded (${owner.maxRamMb} MB)`);
    if (mine.diskGb + (delta.diskGb ?? 0) > owner.maxDiskGb)
      throw new ApiError(403, `Disk quota exceeded (${owner.maxDiskGb} GB)`);
  }
  if (host.cpu + (delta.cpu ?? 0) > s.hostCpu * 2)
    throw new ApiError(507, "Host CPU capacity exceeded");
  if (host.ramMb + (delta.ramMb ?? 0) > s.hostRamMb)
    throw new ApiError(507, "Host memory capacity exceeded");
  if (host.diskGb + (delta.diskGb ?? 0) > s.hostDiskGb)
    throw new ApiError(507, "Host storage capacity exceeded");
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function randomMac() {
  const b = randomBytes(3).toString("hex").match(/../g)!.join(":");
  return `52:54:00:${b}`;
}

export function randomPassword(length = 16) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function allocateIp() {
  const s = await getSettings();
  const used = new Set((await db.select({ ip: vms.ipv4 }).from(vms)).map((r) => r.ip));
  for (let i = 10; i < 250; i++) {
    const ip = `${s.subnetPrefix}.${i}`;
    if (!used.has(ip)) return { ip, gateway: `${s.subnetPrefix}.1`, bridge: s.bridge };
  }
  throw new ApiError(507, "No free IPv4 addresses left in the pool");
}

export type CreateVmInput = {
  ownerId: number;
  name: string;
  templateId: number;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  password?: string;
};

export async function createVm(input: CreateVmInput, actor: SessionUser) {
  if (actor.role !== "admin" && input.ownerId !== actor.id) {
    throw new ApiError(403, "You can only create VMs for your own account");
  }
  const [owner] = await db.select().from(users).where(eq(users.id, input.ownerId));
  if (!owner) throw new ApiError(404, "Owner not found");
  if (owner.suspended) throw new ApiError(403, "Account is suspended");

  const [tpl] = await db.select().from(osTemplates).where(eq(osTemplates.id, input.templateId));
  if (!tpl || !tpl.enabled) throw new ApiError(400, "OS template is not available");
  if (input.diskGb < tpl.minDiskGb) {
    throw new ApiError(400, `${tpl.name} needs at least ${tpl.minDiskGb} GB of disk`);
  }

  await assertCapacity(owner, {
    vms: 1,
    cpu: input.cpuCores,
    ramMb: input.ramMb,
    diskGb: input.diskGb,
  });

  const password = input.password || randomPassword();
  for (let attempt = 0; attempt < 3; attempt++) {
    const net = await allocateIp();
    try {
      const [vm] = await db
        .insert(vms)
        .values({
          name: input.name,
          ownerId: owner.id,
          templateId: tpl.id,
          osName: tpl.name,
          status: "installing",
          transitionTo: "running",
          transitionUntil: new Date(Date.now() + 6000),
          cpuCores: input.cpuCores,
          ramMb: input.ramMb,
          diskGb: input.diskGb,
          ipv4: net.ip,
          gateway: net.gateway,
          mac: randomMac(),
          bridge: net.bridge,
          rootPassword: password,
        })
        .returning();
      await addLog(
        vm,
        actor.id,
        `VM created from ${tpl.name} (${input.cpuCores} vCPU, ${input.ramMb} MB RAM, ${input.diskGb} GB disk) for ${owner.username}`,
      );
      return vm;
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } }).code ??
        (err as { cause?: { code?: string } }).cause?.code;
      if (code !== "23505") throw err; // retry only on IP collisions
    }
  }
  throw new ApiError(409, "Could not allocate an IP address, please retry");
}

export type PowerAction = "start" | "stop" | "restart" | "kill";

export async function powerAction(vm: ClientVm, action: PowerAction, actor: SessionUser) {
  assertControllable(vm, actor);
  const now = Date.now();
  const update = (values: Partial<VmRow>) =>
    db.update(vms).set(values).where(eq(vms.id, vm.id));

  // driver: start/stop/restart map to `virsh start|shutdown|reboot|destroy`
  switch (action) {
    case "start":
      if (vm.status !== "stopped") throw new ApiError(409, `VM is already ${vm.status}`);
      await update({
        status: "starting",
        transitionTo: "running",
        transitionUntil: new Date(now + 2500),
        startedAt: null,
      });
      await addLog(
        vm,
        actor.id,
        vm.isoName ? `Start requested, booting from ISO ${vm.isoName}` : "Start requested",
      );
      break;
    case "stop":
      if (vm.status !== "running") throw new ApiError(409, `VM is ${vm.status}, not running`);
      await update({
        status: "stopping",
        transitionTo: "stopped",
        transitionUntil: new Date(now + 2000),
      });
      await addLog(vm, actor.id, "Graceful shutdown requested (ACPI)");
      break;
    case "restart":
      if (vm.status !== "running") throw new ApiError(409, `VM is ${vm.status}, not running`);
      await update({
        status: "starting",
        transitionTo: "running",
        transitionUntil: new Date(now + 3500),
        startedAt: null,
      });
      await addLog(vm, actor.id, "Restart requested");
      break;
    case "kill":
      if (vm.status === "stopped") throw new ApiError(409, "VM is already stopped");
      await update({
        status: "stopped",
        transitionTo: null,
        transitionUntil: null,
        startedAt: null,
      });
      await addLog(vm, actor.id, "Forced power off", "warn");
      break;
  }
}

export async function setSuspended(vm: ClientVm, suspended: boolean, actor: SessionUser) {
  if (actor.role !== "admin") throw new ApiError(403, "Administrator access required");
  await db
    .update(vms)
    .set(
      suspended
        ? { suspended: true, status: "stopped", transitionTo: null, transitionUntil: null, startedAt: null }
        : { suspended: false },
    )
    .where(eq(vms.id, vm.id));
  await addLog(vm, actor.id, suspended ? "VM suspended by administrator" : "VM unsuspended", "warn");
}

export async function reinstallVm(
  vm: ClientVm,
  templateId: number,
  password: string | undefined,
  actor: SessionUser,
) {
  assertControllable(vm, actor);
  const [tpl] = await db.select().from(osTemplates).where(eq(osTemplates.id, templateId));
  if (!tpl || !tpl.enabled) throw new ApiError(400, "OS template is not available");
  if (vm.diskGb < tpl.minDiskGb) {
    throw new ApiError(400, `${tpl.name} needs at least ${tpl.minDiskGb} GB of disk`);
  }
  const newPassword = password || randomPassword();
  // driver: wipe the qcow2 image, clone the template, regenerate cloud-init seed
  await db
    .update(vms)
    .set({
      templateId: tpl.id,
      osName: tpl.name,
      rootPassword: newPassword,
      isoId: null,
      status: "installing",
      transitionTo: "running",
      transitionUntil: new Date(Date.now() + 7000),
      startedAt: null,
    })
    .where(eq(vms.id, vm.id));
  await addLog(vm, actor.id, `Reinstall started: ${vm.osName} → ${tpl.name}`, "warn");
  return newPassword;
}

export async function setIso(vm: ClientVm, isoId: number | null, actor: SessionUser) {
  if (vm.status === "installing") throw new ApiError(409, "VM is busy installing an OS");
  if (vm.suspended && actor.role !== "admin") throw new ApiError(403, "VM is suspended");
  let isoName: string | null = null;
  if (isoId !== null) {
    const [iso] = await db.select().from(isos).where(eq(isos.id, isoId));
    if (!iso) throw new ApiError(404, "ISO not found");
    isoName = iso.name;
  }
  await db.update(vms).set({ isoId }).where(eq(vms.id, vm.id));
  await addLog(
    vm,
    actor.id,
    isoName ? `ISO attached: ${isoName} (boots on next start)` : `ISO ejected${vm.isoName ? `: ${vm.isoName}` : ""}`,
  );
}

export async function resizeDisk(vm: ClientVm, newGb: number, actor: SessionUser) {
  if (actor.role !== "admin") throw new ApiError(403, "Administrator access required");
  assertControllable(vm, actor);
  if (newGb <= vm.diskGb) throw new ApiError(400, "Disks can only be grown, not shrunk");
  const [owner] = await db.select().from(users).where(eq(users.id, vm.ownerId));
  if (!owner) throw new ApiError(404, "Owner not found");
  await assertCapacity(owner, { diskGb: newGb - vm.diskGb });
  // driver: `qemu-img resize disk.qcow2 +NG` followed by guest growpart
  await db.update(vms).set({ diskGb: newGb }).where(eq(vms.id, vm.id));
  await addLog(vm, actor.id, `Disk resized ${vm.diskGb} GB → ${newGb} GB`);
}

export async function setResources(
  vm: ClientVm,
  cpuCores: number,
  ramMb: number,
  actor: SessionUser,
) {
  if (actor.role !== "admin") throw new ApiError(403, "Administrator access required");
  if (vm.status !== "stopped") throw new ApiError(409, "Stop the VM before changing resources");
  const [owner] = await db.select().from(users).where(eq(users.id, vm.ownerId));
  if (!owner) throw new ApiError(404, "Owner not found");
  await assertCapacity(owner, { cpu: cpuCores - vm.cpuCores, ramMb: ramMb - vm.ramMb });
  await db.update(vms).set({ cpuCores, ramMb }).where(eq(vms.id, vm.id));
  await addLog(
    vm,
    actor.id,
    `Resources changed: ${vm.cpuCores} vCPU / ${vm.ramMb} MB → ${cpuCores} vCPU / ${ramMb} MB`,
  );
}

export async function setNetwork(
  vm: ClientVm,
  bridge: string,
  vlan: number | null,
  actor: SessionUser,
) {
  if (actor.role !== "admin") throw new ApiError(403, "Administrator access required");
  await db.update(vms).set({ bridge, vlan }).where(eq(vms.id, vm.id));
  await addLog(vm, actor.id, `Network updated: bridge ${bridge}, VLAN ${vlan ?? "none"}`);
}

export async function renameVm(vm: ClientVm, name: string, actor: SessionUser) {
  if (vm.suspended && actor.role !== "admin") throw new ApiError(403, "VM is suspended");
  await db.update(vms).set({ name }).where(eq(vms.id, vm.id));
  await addLog({ id: vm.id, name }, actor.id, `Renamed ${vm.name} → ${name}`);
}

export async function setRootPassword(vm: ClientVm, password: string, actor: SessionUser) {
  assertControllable(vm, actor);
  // driver: regenerate cloud-init user-data / `virsh set-user-password`
  await db.update(vms).set({ rootPassword: password }).where(eq(vms.id, vm.id));
  await addLog(vm, actor.id, "Root password changed");
}

export async function deleteVm(vm: ClientVm, actor: SessionUser) {
  if (vm.suspended && actor.role !== "admin") throw new ApiError(403, "VM is suspended");
  // driver: `virsh destroy` + `virsh undefine --remove-all-storage`
  await db.delete(vms).where(eq(vms.id, vm.id));
  await addLog({ id: null, name: vm.name }, actor.id, `VM ${vm.name} (${vm.ipv4}) deleted`, "warn");
}

/* ------------------------------------------------------------------ */
/* Live metrics (simulated telemetry)                                  */
/* ------------------------------------------------------------------ */

export type MetricSample = {
  t: number;
  cpu: number;
  memPct: number;
  memUsedMb: number;
  rxKbps: number;
  txKbps: number;
  readKbps: number;
  writeKbps: number;
};

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function sampleAt(vm: ClientVm, tMs: number): MetricSample {
  const bucket = Math.floor(tMs / 2000) * 2;
  const started = vm.startedAt ? Date.parse(vm.startedAt) : Infinity;
  if (vm.status !== "running" || started > tMs) {
    return { t: bucket * 1000, cpu: 0, memPct: 0, memUsedMb: 0, rxKbps: 0, txKbps: 0, readKbps: 0, writeKbps: 0 };
  }
  const r = rng(vm.id * 7919 + bucket);
  const p = vm.id * 1.7;
  const load = 1 / Math.sqrt(Math.max(1, vm.cpuCores / 2));
  const cpu = clamp((13 + 11 * Math.sin(bucket / 37 + p) + 6 * Math.sin(bucket / 11 + p * 2) + r() * 9) * load + 2, 0.4, 98);
  const memPct = clamp(27 + 6 * Math.sin(bucket / 301 + p) + r() * 1.2 + (bucket % 600) / 120, 8, 92);
  const rx = Math.max(0, 140 + 100 * Math.sin(bucket / 23 + p) + r() * 220);
  const tx = Math.max(0, 60 + 45 * Math.sin(bucket / 29 + p * 1.3) + r() * 110);
  const rd = Math.max(0, r() * r() * 900 * (1 + Math.sin(bucket / 17 + p)));
  const wr = Math.max(0, 25 + r() * r() * 1400 * (1 + Math.sin(bucket / 19 + p * 2)));
  return {
    t: bucket * 1000,
    cpu: Math.round(cpu * 10) / 10,
    memPct: Math.round(memPct * 10) / 10,
    memUsedMb: Math.round((vm.ramMb * memPct) / 100),
    rxKbps: Math.round(rx),
    txKbps: Math.round(tx),
    readKbps: Math.round(rd),
    writeKbps: Math.round(wr),
  };
}

export function diskUsedGb(vm: ClientVm) {
  const frac = 0.09 + ((vm.id * 37) % 17) / 100;
  return Math.min(vm.diskGb, Math.max(1.8, Math.round(vm.diskGb * frac * 10) / 10));
}

export function metricsFor(vm: ClientVm, withHistory: boolean) {
  const now = Date.now();
  const current = sampleAt(vm, now);
  const history: MetricSample[] = [];
  if (withHistory) {
    for (let i = 29; i >= 1; i--) history.push(sampleAt(vm, now - i * 2000));
  }
  history.push(current);
  return {
    current,
    history: withHistory ? history : undefined,
    uptimeSec:
      vm.status === "running" && vm.startedAt
        ? Math.max(0, Math.floor((now - Date.parse(vm.startedAt)) / 1000))
        : 0,
    diskUsedGb: diskUsedGb(vm),
  };
}

/* ------------------------------------------------------------------ */
/* Console (simulated shell)                                           */
/* ------------------------------------------------------------------ */

function kernelFor(os: string) {
  const o = os.toLowerCase();
  if (o.includes("ubuntu")) return "6.8.0-45-generic";
  if (o.includes("debian")) return "6.1.0-25-amd64";
  if (o.includes("fedora")) return "6.8.5-301.fc40.x86_64";
  return "5.14.0-427.13.1.el9_4.x86_64";
}

export type ConsoleResult = {
  output: string;
  clear?: boolean;
  action?: "poweroff" | "reboot";
};

export function runConsole(vm: ClientVm, raw: string): ConsoleResult {
  const line = raw.trim().slice(0, 300);
  if (!line) return { output: "" };
  const [cmd, ...args] = line.split(/\s+/);
  const m = sampleAt(vm, Date.now());
  const up = vm.startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(vm.startedAt)) / 1000)) : 0;
  const kernel = kernelFor(vm.osName);
  const flag = args.join(" ");

  switch (cmd) {
    case "help":
      return {
        output:
          "Available commands (simulated shell):\n" +
          "  whoami  id  hostname  pwd  ls  cat  uname  uptime  date  echo\n" +
          "  free  df  nproc  lscpu  ip  ping  top  neofetch  apt/dnf\n" +
          "  clear  reboot  poweroff",
      };
    case "clear":
      return { output: "", clear: true };
    case "whoami":
      return { output: vm.rootUsername };
    case "id":
      return { output: "uid=0(root) gid=0(root) groups=0(root)" };
    case "hostname":
      return { output: vm.name };
    case "pwd":
      return { output: "/root" };
    case "echo":
      return { output: args.join(" ") };
    case "date":
      return { output: new Date().toUTCString().replace("GMT", "UTC") };
    case "ls":
      return flag.includes("l")
        ? {
            output:
              "total 16\ndrwx------ 4 root root 4096 Jan  9 10:21 .\ndrwxr-xr-x 19 root root 4096 Jan  9 10:20 ..\n-rw-r--r-- 1 root root  412 Jan  9 10:21 README.txt\ndrwxr-xr-x 2 root root 4096 Jan  9 10:21 backups",
          }
        : { output: "README.txt  backups" };
    case "cat":
      if (args[0] === "/etc/os-release") {
        return {
          output: `PRETTY_NAME="${vm.osName}"\nNAME="${vm.osName.split(" ")[0]}"\nID=${vm.osName.split(" ")[0].toLowerCase()}\nHOME_URL="https://tuffnode.local/"`,
        };
      }
      if (args[0] === "README.txt") {
        return {
          output: `Welcome to ${vm.name}!\nThis VM is managed by TuffNode TVM.\nAssigned address: ${vm.ipv4}`,
        };
      }
      return { output: args[0] ? `cat: ${args[0]}: No such file or directory` : "" };
    case "uname":
      return {
        output: flag.includes("a")
          ? `Linux ${vm.name} ${kernel} #45 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`
          : flag.includes("r")
            ? kernel
            : "Linux",
      };
    case "nproc":
      return { output: String(vm.cpuCores) };
    case "uptime": {
      const d = new Date();
      const hh = d.toISOString().slice(11, 19);
      const l = (m.cpu / 100 * vm.cpuCores).toFixed(2);
      return { output: ` ${hh} up ${Math.floor(up / 60)} min,  1 user,  load average: ${l}, ${l}, ${l}` };
    }
    case "free": {
      const total = vm.ramMb;
      const used = m.memUsedMb;
      const human = flag.includes("h");
      const f = (n: number) => (human ? `${(n / 1024).toFixed(1)}Gi`.padStart(8) : String(n).padStart(10));
      return {
        output:
          `               total        used        free      shared  buff/cache   available\n` +
          `Mem:     ${f(total)}  ${f(used)}  ${f(total - used)}  ${f(12)}  ${f(Math.round(total * 0.12))}  ${f(Math.round(total - used * 0.9))}\n` +
          `Swap:    ${f(0)}  ${f(0)}  ${f(0)}`,
      };
    }
    case "df": {
      const used = diskUsedGb(vm);
      return {
        output:
          `Filesystem      Size  Used Avail Use% Mounted on\n` +
          `/dev/vda1       ${String(vm.diskGb - 1).padStart(3)}G ${used.toFixed(1).padStart(4)}G ${(vm.diskGb - 1 - used).toFixed(1).padStart(4)}G ${String(Math.round((used / vm.diskGb) * 100)).padStart(3)}% /\n` +
          `tmpfs           ${(vm.ramMb / 2048).toFixed(1)}G     0 ${(vm.ramMb / 2048).toFixed(1)}G   0% /dev/shm`,
      };
    }
    case "lscpu":
      return {
        output:
          `Architecture:        x86_64\nCPU(s):              ${vm.cpuCores}\nModel name:          QEMU Virtual CPU (KVM, host-passthrough)\nHypervisor vendor:   KVM\nVirtualization type: full`,
      };
    case "ip":
    case "ifconfig":
      return {
        output:
          `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n` +
          `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    link/ether ${vm.mac} brd ff:ff:ff:ff:ff:ff\n    inet ${vm.ipv4}/24 brd ${vm.ipv4.split(".").slice(0, 3).join(".")}.255 scope global eth0\n    gateway ${vm.gateway}`,
      };
    case "ping": {
      const host = args[0] ?? "";
      if (!host) return { output: "ping: usage error: Destination address required" };
      const t = () => (8 + Math.random() * 6).toFixed(1);
      return {
        output:
          `PING ${host} 56(84) bytes of data.\n` +
          `64 bytes from ${host}: icmp_seq=1 ttl=57 time=${t()} ms\n` +
          `64 bytes from ${host}: icmp_seq=2 ttl=57 time=${t()} ms\n` +
          `64 bytes from ${host}: icmp_seq=3 ttl=57 time=${t()} ms\n\n` +
          `--- ${host} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss`,
      };
    }
    case "top":
      return {
        output:
          `top - up ${Math.floor(up / 60)} min,  1 user\n` +
          `%Cpu(s): ${m.cpu.toFixed(1)} us, ${(m.cpu / 5).toFixed(1)} sy, ${(100 - m.cpu * 1.2).toFixed(1)} id\n` +
          `MiB Mem : ${vm.ramMb}.0 total, ${vm.ramMb - m.memUsedMb}.0 free, ${m.memUsedMb}.0 used\n\n` +
          `  PID USER   %CPU %MEM COMMAND\n    1 root    0.0  0.4 systemd\n  612 root    ${(m.cpu / 3).toFixed(1)}  1.2 sshd\n  841 root    ${(m.cpu / 2).toFixed(1)}  3.1 nginx`,
      };
    case "neofetch":
      return {
        output:
          `root@${vm.name}\n---------------\n` +
          `OS: ${vm.osName} x86_64\nHost: KVM/QEMU (TuffNode TVM)\nKernel: ${kernel}\nUptime: ${Math.floor(up / 60)} mins\n` +
          `CPU: QEMU Virtual CPU (${vm.cpuCores})\nMemory: ${m.memUsedMb}MiB / ${vm.ramMb}MiB`,
      };
    case "apt":
    case "apt-get":
    case "dnf":
    case "yum":
      return { output: `Reading package lists... Done\nBuilding dependency tree... Done\nAll packages are up to date.` };
    case "reboot":
      return { output: "The system is going down for reboot NOW!", action: "reboot" };
    case "poweroff":
    case "shutdown":
    case "halt":
      return { output: "The system is going down for poweroff NOW!", action: "poweroff" };
    default:
      return { output: `bash: ${cmd}: command not found` };
  }
}

export async function listVmLogs(vmId: number, limit = 100) {
  return db
    .select({
      id: vmLogs.id,
      level: vmLogs.level,
      message: vmLogs.message,
      createdAt: vmLogs.createdAt,
      username: users.username,
    })
    .from(vmLogs)
    .leftJoin(users, eq(users.id, vmLogs.userId))
    .where(eq(vmLogs.vmId, vmId))
    .orderBy(desc(vmLogs.id))
    .limit(limit);
}
