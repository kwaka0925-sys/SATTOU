"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { yen, pct } from "@/lib/format";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  Filter,
  Megaphone,
  Percent,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import type { SheetInvoice } from "@/lib/sheets";

type Props = {
  rows: SheetInvoice[];
  month: string;
  configured: boolean;
  isMock: boolean;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-");
  const mNum = parseInt(m, 10);
  const opMonth = mNum === 1 ? 12 : mNum - 1;
  return `${y}年${mNum}月分（${opMonth}月稼働分）`;
}

// 稼働月 = 表示月の前月をデフォルトに (「2026年7月分（6月稼働分）」の運用月）
function operatingMonthRange(month: string): { since: string; until: string } {
  const [y, m] = month.split("-").map((v) => parseInt(v, 10));
  const opYear = m === 1 ? y - 1 : y;
  const opMonth = m === 1 ? 12 : m - 1;
  const mm = String(opMonth).padStart(2, "0");
  const lastDay = new Date(opYear, opMonth, 0).getDate();
  return {
    since: `${opYear}-${mm}-01`,
    until: `${opYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

type SyncResult = {
  clientKey: string;
  clientName: string;
  adAccountId: string;
  spend: number;
  currency?: string;
  error?: string;
};

type SyncState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      results: SyncResult[];
      matched: number;
      total: number;
      totalSpend: number;
      errorCount: number;
      since: string;
      until: string;
    }
  | { status: "error"; message: string };

export default function AdsView({ rows, month, configured, isMock }: Props) {
  const [q, setQ] = useState("");
  const [marketer, setMarketer] = useState<string>("all");
  const defaultRange = useMemo(() => operatingMonthRange(month), [month]);
  const [since, setSince] = useState(defaultRange.since);
  const [until, setUntil] = useState(defaultRange.until);
  const [sync, setSync] = useState<SyncState>({ status: "idle" });

  const syncMap = useMemo(() => {
    if (sync.status !== "success") return new Map<string, number>();
    const m = new Map<string, number>();
    sync.results.forEach((r) => {
      if (!r.error) m.set(r.clientKey, r.spend);
    });
    return m;
  }, [sync]);

  const handleSync = async () => {
    setSync({ status: "loading" });
    try {
      const params = new URLSearchParams({ since, until, month });
      const res = await fetch(`/api/meta-ads-sync?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Unknown" }))) as {
          error?: string;
        };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        matched: number;
        total: number;
        totalSpend: number;
        errorCount: number;
        results: SyncResult[];
        since: string;
        until: string;
      };
      setSync({
        status: "success",
        results: data.results,
        matched: data.matched,
        total: data.total,
        totalSpend: data.totalSpend,
        errorCount: data.errorCount,
        since: data.since,
        until: data.until,
      });
    } catch (err) {
      setSync({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const applyPreset = (kind: "op-month" | "last7" | "last30" | "this-month") => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (kind === "op-month") {
      const r = operatingMonthRange(month);
      setSince(r.since);
      setUntil(r.until);
    } else if (kind === "last7") {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      setSince(iso(from));
      setUntil(iso(today));
    } else if (kind === "last30") {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      setSince(iso(from));
      setUntil(iso(today));
    } else if (kind === "this-month") {
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const last = new Date(y, m, 0).getDate();
      const mm = String(m).padStart(2, "0");
      setSince(`${y}-${mm}-01`);
      setUntil(`${y}-${mm}-${String(last).padStart(2, "0")}`);
    }
  };

  const marketers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.marketer) set.add(r.marketer);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (marketer !== "all" && r.marketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        if (!r.clientName.toLowerCase().includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, marketer]);

  // Meta同期済みの行はその値を優先、未同期の行はシートの値を使う
  const effectiveSpend = (r: SheetInvoice): number => {
    const synced = syncMap.get(r.id);
    if (synced !== undefined) return synced;
    return r.adSpend ?? 0;
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + effectiveSpend(r),
      minAmount: acc.minAmount + (r.minAmount ?? 0),
      feeExTax: acc.feeExTax + (r.operationFeeExTax ?? 0),
      feeIncTax: acc.feeIncTax + (r.operationFeeIncTax ?? 0),
    }),
    { adSpend: 0, minAmount: 0, feeExTax: 0, feeIncTax: 0 },
  );
  const avgMargin =
    totals.adSpend > 0 ? totals.feeIncTax / totals.adSpend : 0;

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        title="運用代行売上"
        subtitle={`${monthTitle(month)} · クライアント別の広告費・運用代行費 (${filtered.length} 社表示)`}
      />
      <div className="shrink-0 px-6 pt-4 pb-3 space-y-3">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-2">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN </code>
            を Vercel の環境変数に登録すると、シート列R〜V（広告費・下限額・運用代行税抜/税込）が反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-2">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
          </div>
        )}

        {/* 1段目: コンパクトなKPIタイル4枚 (色分けで役割を可視化) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            size="sm"
            accent="warning"
            label="総広告費"
            value={yen(totals.adSpend)}
            icon={<Megaphone className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="brand"
            label="総運用代行 (税抜)"
            value={yen(totals.feeExTax)}
            icon={<Coins className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="primary"
            label="総運用代行 (税込)"
            value={yen(totals.feeIncTax)}
            icon={<Coins className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="success"
            label="平均マージン率"
            value={pct(avgMargin, 1)}
            icon={<Percent className="w-4 h-4" />}
          />
        </div>

        {/* Meta 広告費同期バー */}
        <div className="card p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Zap className="w-4 h-4 text-brand-600" />
              Meta 広告費同期
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">開始</span>
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="input text-xs w-auto"
              />
              <span className="text-xs text-slate-500">〜</span>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="input text-xs w-auto"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset("op-month")}
                className="text-[11px] text-brand-700 hover:underline px-1"
                title="表示月の稼働月（前月1日〜末日）"
              >
                稼働月
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => applyPreset("this-month")}
                className="text-[11px] text-brand-700 hover:underline px-1"
              >
                今月
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => applyPreset("last7")}
                className="text-[11px] text-brand-700 hover:underline px-1"
              >
                過去7日
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => applyPreset("last30")}
                className="text-[11px] text-brand-700 hover:underline px-1"
              >
                過去30日
              </button>
            </div>
            <button
              type="button"
              onClick={handleSync}
              disabled={sync.status === "loading"}
              className="btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
            >
              <RefreshCw
                className={`w-3 h-3 ${sync.status === "loading" ? "animate-spin" : ""}`}
              />
              {sync.status === "loading" ? "同期中..." : "Meta同期"}
            </button>
          </div>

          {sync.status === "success" && (
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
              <span className="text-emerald-700 font-medium">
                ✓ {sync.since} 〜 {sync.until} の広告費を同期しました
              </span>
              <span>
                対象 {sync.matched} 社 / 合計 {yen(sync.totalSpend)}
              </span>
              {sync.errorCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="w-3 h-3" />
                  {sync.errorCount} 社でエラー
                </span>
              )}
            </div>
          )}

          {sync.status === "error" && (
            <div className="text-xs text-rose-700 flex items-start gap-2 border-t border-slate-100 pt-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">同期に失敗しました</div>
                <div className="text-rose-600 mt-0.5">{sync.message}</div>
              </div>
            </div>
          )}
        </div>

        {/* 検索 + フィルタ + 月ピッカー */}
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名で検索"
              className="input pl-9"
            />
          </div>
          {marketers.length > 0 && (
            <>
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={marketer}
                onChange={(e) => setMarketer(e.target.value)}
                className="input w-auto"
              >
                <option value="all">担当すべて</option>
                {marketers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">月表示</span>
            <MonthPicker current={month} />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="card h-full flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide shadow-sm">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-30 min-w-[180px]">
                    サロン名
                  </th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">別の広告費URL</th>
                  <th className="text-right font-medium px-4 py-3">広告費</th>
                  <th className="text-right font-medium px-4 py-3">下限額</th>
                  <th className="text-right font-medium px-4 py-3">運用代行 (税抜)</th>
                  <th className="text-right font-medium px-4 py-3">運用代行 (税込)</th>
                  <th className="text-right font-medium px-4 py-3">マージン率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const syncedSpend = syncMap.get(r.id);
                  const displaySpend =
                    syncedSpend !== undefined ? syncedSpend : r.adSpend;
                  const margin =
                    displaySpend && displaySpend > 0 && r.operationFeeIncTax
                      ? r.operationFeeIncTax / displaySpend
                      : null;
                  const syncedError =
                    sync.status === "success"
                      ? sync.results.find((x) => x.clientKey === r.id)?.error
                      : undefined;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        {r.clientId ? (
                          <Link
                            href={`/clients/${r.clientId}`}
                            className="font-medium hover:text-brand-700"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.clientName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.marketer ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.otherAdSpendUrl ? (
                          <a
                            href={r.otherAdSpendUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs"
                          >
                            開く <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums"
                        title={syncedError ?? undefined}
                      >
                        {displaySpend != null ? (
                          <span className="inline-flex items-center gap-1">
                            {syncedSpend !== undefined && (
                              <Zap
                                className="w-3 h-3 text-brand-500"
                                aria-label="Meta同期済み"
                              />
                            )}
                            {yen(displaySpend)}
                          </span>
                        ) : syncedError ? (
                          <span className="inline-flex items-center gap-1 text-rose-500 text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            error
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {r.minAmount != null ? yen(r.minAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.operationFeeExTax != null
                          ? yen(r.operationFeeExTax)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {r.operationFeeIncTax != null
                          ? yen(r.operationFeeIncTax)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-emerald-700">
                        {margin != null ? pct(margin, 1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
