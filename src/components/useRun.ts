"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";

/** Runs an async action with a busy key, error toasts and an optional router refresh. */
export function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      opts: { success?: string; refresh?: boolean } = {},
    ): Promise<T | undefined> => {
      setBusy(key);
      try {
        const result = await fn();
        if (opts.success) toast(opts.success, "success");
        if (opts.refresh !== false) router.refresh();
        return result;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Something went wrong", "error");
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast, router],
  );

  return { run, busy };
}
