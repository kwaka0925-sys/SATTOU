import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

type Size = "md" | "sm";

export default function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
  size?: Size;
}) {
  const positive = (delta ?? 0) >= 0;
  const cardPad = size === "sm" ? "p-4" : "p-5";
  const labelCls =
    size === "sm" ? "text-xs text-slate-500" : "text-sm text-slate-500";
  const valueCls =
    size === "sm"
      ? "mt-1 text-xl font-semibold tracking-tight"
      : "mt-2 text-2xl font-semibold tracking-tight";
  const footGap = size === "sm" ? "mt-1" : "mt-2";
  return (
    <div className={`card ${cardPad}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={labelCls}>{label}</div>
        {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
      </div>
      <div className={valueCls}>{value}</div>
      <div className={`${footGap} flex items-center gap-2 text-xs`}>
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
