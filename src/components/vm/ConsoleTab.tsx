"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/Icon";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { ClientVm, ConsoleResult } from "@/lib/vm";
import { vmAction, type TabProps } from "@/components/vm/types";

export function ConsoleTab({ vm, reload }: TabProps) {
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  if (vm.status !== "running") {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-xl border border-line bg-black/60 p-8 text-center">
        <div>
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/5 text-zinc-500">
            <Icon name="terminal" size={22} />
          </div>
          <p className="text-sm font-medium text-white">Console unavailable</p>
          <p className="mt-1 text-sm text-zinc-500">
            {vm.status === "stopped" ? "Power on the VM to open a console session." : `The VM is ${vm.status}…`}
          </p>
          {vm.status === "stopped" && (
            <Button
              className="mt-4"
              variant="success"
              loading={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  await vmAction(vm.id, { action: "power", op: "start" });
                  await reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Failed to start", "error");
                } finally {
                  setStarting(false);
                }
              }}
            >
              <Icon name="play" size={12} /> Start VM
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Remounts on every boot, which resets the session like a real serial console.
  return <Session key={vm.startedAt ?? "boot"} vm={vm} reload={reload} />;
}

function Session({ vm, reload }: { vm: ClientVm; reload: () => Promise<void> }) {
  const prompt = `${vm.rootUsername}@${vm.name}:~#`;
  const [lines, setLines] = useState<string[]>([
    `${vm.osName} ${vm.name} ttyS0`,
    `TuffNode TVM serial console · simulated shell · type "help" for commands`,
    ``,
    `Last login: ${new Date().toUTCString().replace("GMT", "UTC")} on ttyS0`,
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const cmd = input;
    setInput("");
    setCursor(-1);
    setLines((l) => [...l, `${prompt} ${cmd}`]);
    if (!cmd.trim()) return;
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setBusy(true);
    try {
      const res = await api<ConsoleResult>(`/api/vms/${vm.id}/console`, "POST", { command: cmd });
      if (res.clear) setLines([]);
      else if (res.output) setLines((l) => [...l, res.output]);
      if (res.action) {
        setLines((l) => [...l, "Connection closed by remote host."]);
        await reload();
      }
    } catch (err) {
      setLines((l) => [...l, `console: ${err instanceof Error ? err.message : "request failed"}`]);
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(history.length - 1, cursor + 1);
      if (next >= 0) {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = cursor - 1;
      setCursor(next);
      setInput(next >= 0 ? history[next] : "");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#05060a] shadow-inner">
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-xs text-zinc-500">
            {vm.rootUsername}@{vm.name} — ttyS0
          </span>
        </div>
        <button onClick={() => setLines([])} className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-white">
          Clear
        </button>
      </div>
      <div ref={box} onClick={() => field.current?.focus()} className="h-[420px] cursor-text overflow-y-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300">
        {lines.map((l, i) => (
          <pre key={i} className={`whitespace-pre-wrap break-words font-mono ${l.startsWith(prompt) ? "text-zinc-100" : ""}`}>
            {l.startsWith(prompt) ? (
              <>
                <span className="text-emerald-400">{prompt}</span>
                {l.slice(prompt.length)}
              </>
            ) : (
              l
            )}
          </pre>
        ))}
        <form onSubmit={submit} className="flex items-center gap-2">
          <span className="shrink-0 text-emerald-400">{prompt}</span>
          <input
            ref={field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            autoFocus
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={300}
            aria-label="Console input"
            className="min-w-0 flex-1 bg-transparent font-mono text-zinc-100 caret-brand outline-none"
          />
        </form>
      </div>
    </div>
  );
}
