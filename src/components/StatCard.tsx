import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

type Size = "md" | "sm";
type Accent =
  | "default"
  | "primary"
  | "brand"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "muted";

const ACCENT_STYLES: Record<Accent, {
  card: string;
  label: string;
  value: string;
  iconWrap: string;
}> = {
  default: {
    card: "bg-white",
    label: "text-slate-500",
    value: "text-slate-900",
    iconWrap: "text-slate-400",
  },
  // ダッシュボード最上位KPI（総売上）向けの琥珀色
  primary: {
    card: "bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-200/70",
    label: "text-amber-800",
    value: "text-amber-900",
    iconWrap: "text-amber-500",
  },
  // システム売上向けのブランドカラー
  brand: {
    card: "bg-gradient-to-br from-brand-50 to-white ring-1 ring-brand-200/70",
    label: "text-brand-700",
    value: "text-brand-900",
    iconWrap: "text-brand-500",
  },
  // 新規契約数など (成長・ポジティブ)
  success: {
    card: "bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200/70",
    label: "text-emerald-800",
    value: "text-emerald-900",
    iconWrap: "text-emerald-500",
  },
  // 店舗追加数など (追加・中立)
  info: {
    card: "bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-200/70",
    label: "text-sky-800",
    value: "text-sky-900",
    iconWrap: "text-sky-500",
  },
  // 広告運用代行費 (注目)
  warning: {
    card: "bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200/70",
    label: "text-orange-800",
    value: "text-orange-900",
    iconWrap: "text-orange-500",
  },
  // 解約数 (ネガティブ)
  danger: {
    card: "bg-gradient-to-br from-rose-50 to-white ring-1 ring-rose-200/70",
    label: "text-rose-800",
    value: "text-rose-900",
    iconWrap: "text-rose-500",
  },
  // 補足情報 (トーンダウン)
  muted: {
    card: "bg-slate-50",
    label: "text-slate-500",
    value: "text-slate-800",
    iconWrap: "text-slate-400",
  },
};

export default function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
  size = "md",
  accent = "default",
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
  size?: Size;
  accent?: Accent;
}) {
  const positive = (delta ?? 0) >= 0;
  const cardPad = size === "sm" ? "p-4" : "p-5";
  const style = ACCENT_STYLES[accent];
  const labelCls =
    size === "sm"
      ? `text-xs ${style.label}`
      : `text-sm ${style.label}`;
  const valueCls =
    size === "sm"
      ? `mt-1 text-xl font-semibold tracking-tight ${style.value}`
      : `mt-2 text-2xl font-semibold tracking-tight ${style.value}`;
  const footGap = size === "sm" ? "mt-1" : "mt-2";
  return (
    <div className={`card ${cardPad} ${style.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={labelCls}>{label}</div>
        {icon && <div className={`${style.iconWrap} shrink-0`}>{icon}</div>}
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
