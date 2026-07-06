"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { yen, pct } from "@/lib/format";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import { ExternalLink, Filter, Search } from "lucide-react";
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

export default function AdsView({ rows, month, configured, isMock }: Props) {
  const [q, setQ] = useState("");
  const [marketer, setMarketer] = useState<string>("all");

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

  const totals = filtered.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + (r.adSpend ?? 0),
      minAmount: acc.minAmount + (r.minAmount ?? 0),
      feeExTax: acc.feeExTax + (r.operationFeeExTax ?? 0),
      feeIncTax: acc.feeIncTax + (r.operationFeeIncTax ?? 0),
    }),
    { adSpend: 0, minAmount: 0, feeExTax: 0, feeIncTax: 0 },
  );
  const avgMargin =
    totals.adSpend > 0 ? totals.feeIncTax / totals.adSpend : 0;

  return (
    <div>
      <TopBar
        title="運用代行売上"
        subtitle={`${monthTitle(month)} · クライアント別の広告費・運用代行費 (${filtered.length} 社表示)`}
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN </code>
            を Vercel の環境変数に登録すると、シート列R〜V（広告費・下限額・運用代行税抜/税込）が反映されます。数式もそのまま計算結果として表示されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総広告費</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.adSpend)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">総運用代行 (税抜)</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.feeExTax)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">総運用代行 (税込)</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.feeIncTax)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">平均マージン率</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600">
              {pct(avgMargin, 1)}
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
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
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
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
                  const margin =
                    r.adSpend && r.adSpend > 0 && r.operationFeeIncTax
                      ? r.operationFeeIncTax / r.adSpend
                      : null;
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.adSpend != null ? yen(r.adSpend) : "—"}
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
