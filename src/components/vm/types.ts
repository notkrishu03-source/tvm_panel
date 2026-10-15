import type { ClientVm, MetricSample } from "@/lib/vm";
import { api } from "@/lib/client-api";

export type Metrics = {
  current: MetricSample;
  history?: MetricSample[];
  uptimeSec: number;
  diskUsedGb: number;
};

export type IsoOption = { id: number; name: string; filename: string; sizeMb: number };
export type TemplateOption = { id: number; name: string; family: string; minDiskGb: number };

export type TabProps = {
  vm: ClientVm;
  isAdmin: boolean;
  reload: () => Promise<void>;
};

export function vmAction<T = { ok: boolean }>(id: number, body: Record<string, unknown>) {
  return api<T>(`/api/vms/${id}/action`, "POST", body);
}
