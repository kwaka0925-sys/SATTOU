import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export default function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-500">{label}</div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {typeof delta === "number" && (
          <span
            className={`pill ${
              positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}
