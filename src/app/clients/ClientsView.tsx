"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { yen, num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import { Filter, Search } from "lucide-react";
import type { Invoice, InvoicePaymentMethod } from "@/lib/types";
import type { SheetInvoice } from "@/lib/sheets";

const STATUS_LABEL: Record<Invoice["status"], { label: string; cls: string }> = {
  paid: { label: "入金済", cls: "bg-emerald-50 text-emerald-700" },
  unpaid: { label: "未入金", cls: "bg-amber-50 text-amber-700" },
  overdue: { label: "期限超過", cls: "bg-rose-50 text-rose-700" },
  draft: { label: "下書き", cls: "bg-slate-100 text-slate-600" },
};

type PmFilter = "all" | InvoicePaymentMethod;
type StatusFilter = "all" | Invoice["status"];

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

export default function ClientsView({ rows, month, configured, isMock }: Props) {
  const [q, setQ] = useState("");
  const [pm, setPm] = useState<PmFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
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
      if (pm !== "all" && r.paymentMethod !== pm) return false;
      if (status !== "all" && r.status !== status) return false;
      if (marketer !== "all" && r.marketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [
          r.clientName,
          r.subscriberId ?? "",
          r.payeeName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, pm, status, marketer, q]);

  const totals = filtered.reduce(
    (acc, r) => ({
      brand: acc.brand + (r.brandCount ?? 0),
      store: acc.store + (r.storeCount ?? 0),
      amount: acc.amount + r.amount,
      unpaid:
        acc.unpaid +
        (r.status === "unpaid" || r.status === "overdue" ? r.amount : 0),
    }),
    { brand: 0, store: 0, amount: 0, unpaid: 0 },
  );

  return (
    <div>
      <TopBar
        title="クライアント"
        subtitle={`${monthLabel(month)}分 · 全 ${rows.length} 社 / 表示 ${filtered.length} 社`}
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
            を Vercel の環境変数に登録すると、請求書シートの実データがこの画面に反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
            <code className="font-mono">?month=YYYY-MM</code> で別の月を指定できます。
          </div>
        )}
        {configured && rows.length > 0 && totals.amount === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            接続中のシートに請求金額列（G列）のデータが見つかりません。<strong>請求書管理タブ</strong>とは別のタブ（例: sattou導入店舗）を読み込んでいる可能性があります。店舗一覧は <a href="/stores" className="underline text-brand-700">sattou導入店舗</a> に表示されます。
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総ブランド数</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.brand)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">総店舗数</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.store)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">請求総額</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.amount)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">未入金</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">
              {yen(totals.unpaid)}
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 加入者識別番号 / 振込名で検索"
              className="input pl-9"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={pm}
            onChange={(e) => setPm(e.target.value as PmFilter)}
            className="input w-auto"
          >
            <option value="all">支払方法すべて</option>
            <option value="振替">振替</option>
            <option value="請求書">請求書</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">進捗すべて</option>
            <option value="paid">入金済</option>
            <option value="unpaid">未入金</option>
            <option value="overdue">期限超過</option>
            <option value="draft">下書き</option>
          </select>
          {marketers.length > 0 && (
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
                  <th className="text-right font-medium px-4 py-3">ブランド数</th>
                  <th className="text-right font-medium px-4 py-3">店舗数</th>
                  <th className="text-left font-medium px-4 py-3">振替 / 請求書</th>
                  <th className="text-left font-medium px-4 py-3">加入者識別番号</th>
                  <th className="text-left font-medium px-4 py-3">振込名</th>
                  <th className="text-right font-medium px-4 py-3">請求金額 (税込)</th>
                  <th className="text-left font-medium px-4 py-3">進捗</th>
                  <th className="text-left font-medium px-4 py-3">口座振替進捗</th>
                  <th className="text-left font-medium px-4 py-3">継続</th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const st = STATUS_LABEL[r.status];
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.brandCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.storeCount ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.paymentMethod ? (
                          <span
                            className={`pill ${
                              r.paymentMethod === "振替"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-sky-50 text-sky-700"
                            }`}
                          >
                            {r.paymentMethod === "振替" ? "口座振替" : "請求書"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.payeeName ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {yen(r.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`pill ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.bankTransferProgress ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.subscriptionStatus ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.marketer ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate"
                        title={r.note}
                      >
                        {r.note ?? "—"}
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
