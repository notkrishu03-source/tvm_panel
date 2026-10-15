import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type PanelSettings = {
  panelName: string;
  nodeName: string;
  allowRegistration: boolean;
  hostCpu: number;
  hostRamMb: number;
  hostDiskGb: number;
  bridge: string;
  subnetPrefix: string;
  /** Public SSH hostname used in connection strings, e.g. ssh.tuffnode.example */
  sshHost: string;
  defaultMaxVms: number;
  defaultMaxCpu: number;
  defaultMaxRamMb: number;
  defaultMaxDiskGb: number;
};

export const SETTING_DEFAULTS: Record<keyof PanelSettings, string> = {
  panelName: "TuffNode TVM",
  nodeName: "tvm-node-01",
  allowRegistration: "true",
  hostCpu: "32",
  hostRamMb: "131072",
  hostDiskGb: "2000",
  bridge: "br0",
  subnetPrefix: "10.20.0",
  sshHost: "ssh.tuffnode.local",
  defaultMaxVms: "3",
  defaultMaxCpu: "8",
  defaultMaxRamMb: "16384",
  defaultMaxDiskGb: "200",
};

export async function getSettings(): Promise<PanelSettings> {
  const rows = await db.select().from(settings);
  const raw: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) raw[r.key] = r.value;
  const num = (k: keyof PanelSettings) => {
    const n = Number(raw[k]);
    return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[k]);
  };
  return {
    panelName: raw.panelName,
    nodeName: raw.nodeName,
    allowRegistration: raw.allowRegistration === "true",
    hostCpu: num("hostCpu"),
    hostRamMb: num("hostRamMb"),
    hostDiskGb: num("hostDiskGb"),
    bridge: raw.bridge,
    subnetPrefix: raw.subnetPrefix,
    sshHost: raw.sshHost,
    defaultMaxVms: num("defaultMaxVms"),
    defaultMaxCpu: num("defaultMaxCpu"),
    defaultMaxRamMb: num("defaultMaxRamMb"),
    defaultMaxDiskGb: num("defaultMaxDiskGb"),
  };
}

export async function saveSettings(values: Partial<Record<keyof PanelSettings, string>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}
