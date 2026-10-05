"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Award, Crown, Medal, Trophy } from "lucide-react";
import TopBar from "@/components/TopBar";
import RankingScatter from "@/components/charts/RankingScatter";
import { CLIENTS, clientCpa, clientCvr, clientRoas } from "@/lib/mock";
import { num, pct, ratio, yen } from "@/lib/format";
import type { Industry } from "@/lib/types";

type Metric = "cpa" | "bookings" | "roas" | "spend" | "cvr";

const METRICS: { key: Metric; label: string; unit: string; lowerBetter?: boolean }[] = [
  { key: "cpa", label: "CPA（顧客獲得単価）", unit: "yen", lowerBetter: true },
  { key: "bookings", label: "予約数", unit: "num" },
  { key: "roas", label: "ROAS", unit: "ratio" },
  { key: "spend", label: "広告費", unit: "yen" },
  { key: "cvr", label: "CVR", unit: "pct" },
];

function getMetric(c: (typeof CLIENTS)[number], m: Metric): number {
  switch (m) {
    case "cpa":
      return clientCpa(c);
    case "bookings":
      return c.metrics30d.bookings;
    case "roas":
      return clientRoas(c);
    case "spend":
      return c.metrics30d.spend;
    case "cvr":
      return clientCvr(c);
  }
}

function fmtMetric(m: Metric, v: number) {
  switch (m) {
    case "cpa":
    case "spend":
      return v ? yen(v) : "—";
    case "bookings":
      return num(v);
    case "roas":
      return ratio(v);
    case "cvr":
      return pct(v, 1);
  }
}

const INDUSTRIES: (Industry | "all")[] = [
  "all",
  "整体院",
  "整骨院",
  "鍼灸院",
  "美容院",
  "エステ",
  "歯科医院",
  "ジム",
];

export default function RankingsPage() {
  const [metric, setMetric] = useState<Metric>("cpa");
  const [industry, setIndustry] = useState<Industry | "all">("all");
  const [compare, setCompare] = useState<string[]>([]);

  const meta = METRICS.find((m) => m.key === metric)!;

  const ranked = useMemo(() => {
    const list = CLIENTS.filter((c) => industry === "all" || c.industry === industry).filter(
      (c) => c.metrics30d.bookings > 0,
    );
    list.sort((a, b) => {
      const av = getMetric(a, metric);
      const bv = getMetric(b, metric);
      return meta.lowerBetter ? av - bv : bv - av;
    });
    return list;
  }, [metric, industry, meta.lowerBetter]);

  const scatterData = ranked
    .filter((c) => clientCpa(c) > 0)
    .map((c) => ({
      name: c.name,
      spend: c.metrics30d.spend,
      cpa: clientCpa(c),
      bookings: c.metrics30d.bookings,
    }));

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
    );
  };
  const compareClients = compare.map((id) => CLIENTS.find((c) => c.id === id)!).filter(Boolean);

  return (
    <div>
      <TopBar
        title="ランキング・比較"
        subtitle="クライアント間のパフォーマンスを業種・指標で比較"
      />
      <div className="p-6 space-y-6">
        {CLIENTS.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-5 py-4">
            <div className="font-medium mb-1">実データを接続してください</div>
            <div className="text-xs leading-relaxed">
              このランキング画面は個別クライアントの広告・予約データを必要とします。GAS連携を設定してシートの実データを取り込むか、クライアント別データの供給元を確定するとランキングが表示されます。
            </div>
          </div>
        )}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-500">指標</div>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="input w-auto">
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <div className="text-sm text-slate-500">業種</div>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value as Industry | "all")}
            className="input w-auto"
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i === "all" ? "すべて" : i}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500 ml-auto">
            {meta.lowerBetter ? "※ 値が低いほど優秀" : "※ 値が高いほど優秀"}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> ランキング
              </h2>
              <div className="text-xs text-slate-500">{ranked.length} 社</div>
            </div>
            <ul className="divide-y divide-slate-100">
              {ranked.slice(0, 20).map((c, i) => {
                const v = getMetric(c, metric);
                const Icon = i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Award : null;
                const tone = i < 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
                return (
                  <li key={c.id} className="py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold ${tone}`}>
                      {Icon ? <Icon className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700 truncate block">
                        {c.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {c.industry} · {c.prefecture} · 予約 {c.metrics30d.bookings}件
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{fmtMetric(metric, v)}</div>
                      <div className="text-xs text-slate-500">CPA {yen(clientCpa(c))}</div>
                    </div>
                    <button
                      onClick={() => toggleCompare(c.id)}
                      className={`btn text-xs px-3 py-1.5 ${
                        compare.includes(c.id)
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {compare.includes(c.id) ? "比較中" : "比較に追加"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-2">広告費 vs CPA</h2>
            <p className="text-xs text-slate-500 mb-4">
              バブルサイズは予約数。左下に位置するほど効率的な運用です。
            </p>
            <RankingScatter data={scatterData} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">クライアント比較（最大4社）</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ランキング内の「比較に追加」ボタンで選択してください。
              </p>
            </div>
            {compareClients.length > 0 && (
              <button onClick={() => setCompare([])} className="btn-ghost text-xs">
                クリア
              </button>
            )}
          </div>
          {compareClients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
              比較するクライアントを選択するとここに表示されます。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">指標</th>
                    {compareClients.map((c) => (
                      <th key={c.id} className="text-right font-medium px-3 py-2 min-w-[140px]">
                        <Link href={`/clients/${c.id}`} className="hover:text-brand-700">{c.name}</Link>
                        <div className="font-normal text-[11px] text-slate-500">{c.industry}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { key: "spend" as Metric, label: "広告費" },
                    { key: "bookings" as Metric, label: "予約数" },
                    { key: "cpa" as Metric, label: "CPA" },
                    { key: "cvr" as Metric, label: "CVR" },
                    { key: "roas" as Metric, label: "ROAS" },
                  ].map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2 text-slate-500">{row.label}</td>
                      {compareClients.map((c) => (
                        <td key={c.id} className="px-3 py-2 text-right tabular-nums font-medium">
                          {fmtMetric(row.key, getMetric(c, row.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
