import "server-only";
import { count } from "drizzle-orm";
import { randomBytes, scryptSync } from "node:crypto";
import { db } from "@/db";
import { isos, osTemplates, users, vmLogs, vms } from "@/db/schema";

export const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let seeding: Promise<void> | null = null;

/** Seeds the admin account, OS templates, ISO library and a demo VM on first run. */
export function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = runSeed().catch((err) => {
      seeding = null;
      throw err;
    });
  }
  return seeding;
}

async function runSeed() {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) return;

  const salt = randomBytes(16).toString("hex");
  const passwordHash = `scrypt$${salt}$${scryptSync(DEFAULT_ADMIN_PASSWORD, salt, 64).toString("hex")}`;

  const [admin] = await db
    .insert(users)
    .values({
      username: DEFAULT_ADMIN_USERNAME,
      email: "admin@tuffnode.local",
      passwordHash,
      role: "admin",
      maxVms: 50,
      maxCpu: 64,
      maxRamMb: 262144,
      maxDiskGb: 4000,
    })
    .onConflictDoNothing()
    .returning();

  const [{ value: tplCount }] = await db.select({ value: count() }).from(osTemplates);
  let ubuntuId: number | null = null;
  if (tplCount === 0) {
    const inserted = await db
      .insert(osTemplates)
      .values([
        { slug: "ubuntu-24.04", name: "Ubuntu 24.04 LTS", family: "ubuntu", minDiskGb: 10 },
        { slug: "ubuntu-22.04", name: "Ubuntu 22.04 LTS", family: "ubuntu", minDiskGb: 10 },
        { slug: "debian-12", name: "Debian 12 (Bookworm)", family: "debian", minDiskGb: 8 },
        { slug: "debian-11", name: "Debian 11 (Bullseye)", family: "debian", minDiskGb: 8 },
        { slug: "fedora-40", name: "Fedora 40", family: "fedora", minDiskGb: 10 },
        { slug: "centos-stream-9", name: "CentOS Stream 9", family: "centos", minDiskGb: 10 },
        { slug: "almalinux-9", name: "AlmaLinux 9", family: "almalinux", minDiskGb: 10 },
        { slug: "rocky-9", name: "Rocky Linux 9", family: "rocky", minDiskGb: 10 },
      ])
      .onConflictDoNothing()
      .returning();
    ubuntuId = inserted.find((t) => t.slug === "ubuntu-24.04")?.id ?? null;
  }

  const [{ value: isoCount }] = await db.select({ value: count() }).from(isos);
  if (isoCount === 0) {
    await db
      .insert(isos)
      .values([
        { name: "Ubuntu 24.04 Live Server", filename: "ubuntu-24.04-live-server-amd64.iso", sizeMb: 2650 },
        { name: "Debian 12 Netinst", filename: "debian-12.5.0-amd64-netinst.iso", sizeMb: 650 },
        { name: "Alpine Linux 3.20 Standard", filename: "alpine-standard-3.20.0-x86_64.iso", sizeMb: 220 },
        { name: "SystemRescue 11", filename: "systemrescue-11.00-amd64.iso", sizeMb: 960 },
        { name: "VirtIO Drivers (Windows)", filename: "virtio-win-0.1.248.iso", sizeMb: 710 },
      ])
      .onConflictDoNothing();
  }

  if (admin) {
    const [demo] = await db
      .insert(vms)
      .values({
        name: "web-01",
        ownerId: admin.id,
        templateId: ubuntuId,
        osName: "Ubuntu 24.04 LTS",
        status: "running",
        cpuCores: 2,
        ramMb: 2048,
        diskGb: 20,
        ipv4: "10.20.0.10",
        gateway: "10.20.0.1",
        mac: "52:54:00:a1:7c:3e",
        bridge: "br0",
        rootPassword: randomBytes(9).toString("base64url"),
        startedAt: new Date(Date.now() - 3 * 3600_000),
      })
      .onConflictDoNothing()
      .returning();
    if (demo) {
      await db.insert(vmLogs).values({
        vmId: demo.id,
        vmName: demo.name,
        userId: admin.id,
        message: "VM created from template Ubuntu 24.04 LTS",
      });
    }
  }
}
