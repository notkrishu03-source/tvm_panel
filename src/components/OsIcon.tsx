const colors: Record<string, string> = {
  ubuntu: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  debian: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  fedora: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  centos: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  almalinux: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  rocky: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

export function osFamilyOf(name: string): string {
  const first = name.toLowerCase().split(/[\s-]/)[0];
  return first;
}

export function OsIcon({ family, size = 36 }: { family: string; size?: number }) {
  const key = family.toLowerCase();
  const cls = colors[key] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg font-bold uppercase ring-1 ring-inset ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {key.slice(0, 1)}
    </span>
  );
}
