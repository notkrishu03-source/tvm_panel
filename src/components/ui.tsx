"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { VmStatus } from "@/lib/vm";
import { labelCls } from "@/lib/styles";

/* ---------------------------------- Logo --------------------------------- */

export function Logo({ size = 32, showText = true, name = "TuffNode" }: { size?: number; showText?: boolean; name?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id="tn-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fdba74" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <path d="M20 2 36 11v18L20 38 4 29V11z" fill="url(#tn-g)" />
        <path d="M12 14h16v4.2h-6v10.3h-4V18.2h-6z" fill="#1a0f05" />
      </svg>
      {showText && (
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[17px] font-semibold tracking-tight text-white">{name.replace(/ TVM$/, "")}</span>
          <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand">TVM</span>
        </span>
      )}
    </span>
  );
}

/* --------------------------------- Button -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md";
  loading?: boolean;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand text-black hover:bg-brand-soft shadow-[0_0_0_1px_rgba(249,115,22,0.4)]",
  secondary: "border border-line bg-panel2 text-zinc-200 hover:border-zinc-600 hover:bg-[#1e2230]",
  danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  success: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  ghost: "text-zinc-300 hover:bg-white/5",
};

export function Button({ variant = "secondary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------- Cards -------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-panel/90 ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/90 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${accent ?? "text-white"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, label, detail }: { value: number; max: number; label?: string; detail?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-brand";
  return (
    <div>
      {(label || detail) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-zinc-400">{label}</span>
          <span className="tabular-nums text-zinc-300">{detail}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <path d="M7 7h.01M7 17h.01" />
        </svg>
      </div>
      <p className="text-sm font-medium text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------- Badges -------------------------------- */

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" | "orange" }) {
  const tones = {
    zinc: "bg-white/5 text-zinc-300 ring-white/10",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    red: "bg-red-500/10 text-red-300 ring-red-500/25",
    blue: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
    orange: "bg-brand/10 text-brand-soft ring-brand/25",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, suspended }: { status: VmStatus; suspended?: boolean }) {
  if (suspended) {
    return (
      <Badge tone="red">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Suspended
      </Badge>
    );
  }
  const map: Record<VmStatus, { tone: "green" | "zinc" | "amber" | "blue"; label: string; dot: string; pulse?: boolean }> = {
    running: { tone: "green", label: "Running", dot: "bg-emerald-400" },
    stopped: { tone: "zinc", label: "Stopped", dot: "bg-zinc-500" },
    starting: { tone: "amber", label: "Starting", dot: "bg-amber-400", pulse: true },
    stopping: { tone: "amber", label: "Stopping", dot: "bg-amber-400", pulse: true },
    installing: { tone: "blue", label: "Installing", dot: "bg-sky-400", pulse: true },
  };
  const s = map[status];
  return (
    <Badge tone={s.tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
      {s.label}
    </Badge>
  );
}

/* ---------------------------------- Forms -------------------------------- */

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-brand" : "bg-zinc-700"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

/* ---------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="tn-fade fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`tn-pop my-8 w-full ${width} rounded-xl border border-line bg-panel shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  requireText,
  danger = true,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  requireText?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setTyped("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={requireText ? typed !== requireText : false}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setTyped("");
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-zinc-300">
        <div>{description}</div>
        {requireText && (
          <div>
            <p className="mb-1.5 text-xs text-zinc-500">
              Type <span className="rounded bg-white/10 px-1 font-mono text-zinc-200">{requireText}</span> to confirm
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-line bg-bg/80 px-3 py-2 text-sm outline-none focus:border-red-500/60"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------- Toasts ------------------------------- */

type Toast = { id: number; message: string; type: "success" | "error" | "info" };
const ToastCtx = createContext<(message: string, type?: Toast["type"]) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`tn-pop pointer-events-auto rounded-lg border px-3.5 py-2.5 text-sm shadow-xl backdrop-blur ${
              t.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-100"
                : t.type === "error"
                  ? "border-red-500/30 bg-red-950/80 text-red-100"
                  : "border-line bg-panel2/95 text-zinc-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
