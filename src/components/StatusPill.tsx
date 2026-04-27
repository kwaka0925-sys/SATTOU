import type { ClientStatus } from "@/lib/types";

const MAP: Record<ClientStatus, { label: string; cls: string }> = {
  active: { label: "稼働中", cls: "bg-emerald-50 text-emerald-700" },
  paused: { label: "停止中", cls: "bg-slate-100 text-slate-600" },
  trial: { label: "トライアル", cls: "bg-amber-50 text-amber-700" },
};

export default function StatusPill({ status }: { status: ClientStatus }) {
  const m = MAP[status];
  return <span className={`pill ${m.cls}`}>{m.label}</span>;
}
