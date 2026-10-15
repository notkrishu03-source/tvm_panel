import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Logo } from "@/components/ui";

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "power", title: "Full VM lifecycle", text: "Start, stop, restart, force-off and reinstall in one click." },
  { icon: "terminal", title: "Web console", text: "Jump into a live shell and watch CPU, RAM and network in real time." },
  { icon: "disc", title: "ISOs & templates", text: "Deploy Ubuntu, Debian, Fedora, Alma or boot your own ISO." },
  { icon: "network", title: "Networking & disks", text: "Static IPv4, bridges, VLANs and online disk growth." },
];

export function AuthShell({ children, panelName }: { children: ReactNode; panelName: string }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)",
          }}
        />
        <div className="relative">
          <Logo size={38} name={panelName} />
        </div>
        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Your KVM servers,
            <br />
            <span className="bg-gradient-to-r from-brand-soft to-orange-600 bg-clip-text text-transparent">
              under your control.
            </span>
          </h2>
          <p className="mt-4 text-zinc-400">
            A fast, no-nonsense panel for creating and managing virtual machines on TuffNode hardware.
          </p>
          <ul className="mt-9 grid gap-5 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
                  <Icon name={f.icon} size={17} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{f.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-zinc-600">© {new Date().getFullYear()} TuffNode · TVM Panel</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 lg:hidden">
          <Logo size={34} name={panelName} />
        </div>
        {children}
      </div>
    </div>
  );
}
