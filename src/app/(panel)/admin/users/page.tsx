import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, vms } from "@/db/schema";
import { UsersManager, type UserRow } from "@/components/admin/UsersManager";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const [rows, settings] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        suspended: users.suspended,
        maxVms: users.maxVms,
        maxCpu: users.maxCpu,
        maxRamMb: users.maxRamMb,
        maxDiskGb: users.maxDiskGb,
        createdAt: users.createdAt,
        vmCount: sql<number>`count(${vms.id})::int`,
      })
      .from(users)
      .leftJoin(vms, eq(vms.ownerId, users.id))
      .groupBy(users.id)
      .orderBy(asc(users.id)),
    getSettings(),
  ]);

  const list: UserRow[] = rows.map((r) => ({
    ...r,
    role: r.role === "admin" ? "admin" : "user",
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, roles and resource quotas" />
      <UsersManager
        users={list}
        currentUserId={admin.id}
        defaults={{
          maxVms: settings.defaultMaxVms,
          maxCpu: settings.defaultMaxCpu,
          maxRamMb: settings.defaultMaxRamMb,
          maxDiskGb: settings.defaultMaxDiskGb,
        }}
      />
    </>
  );
}
