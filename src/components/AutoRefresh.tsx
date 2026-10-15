"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data on an interval while `active` (e.g. VMs mid-transition). */
export function AutoRefresh({ active, interval = 2000 }: { active: boolean; interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, interval);
    return () => clearInterval(id);
  }, [active, interval, router]);
  return null;
}
