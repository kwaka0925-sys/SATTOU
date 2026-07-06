"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { UserX, Search } from "lucide-react";
import type { SheetInvoice } from "@/lib/sheets";
import type { MonthRows } from "./page";

type EditableField =
  | "paymentMethod"
  | "status"
  | "subscriptionStatus"
  | "marketer"
  | "note";
type RowOverride = Partial<Record<EditableField, string>>;
type OverridesMap = Record<string, RowOverride>;

const OVERRIDES_STORAGE_KEY = "sattou-invoice-overrides";

type Props = {
  monthlyRows: MonthRows[];
  configured: boolean;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function shortMonth(month: string): string {
  const [, m] = month.split("-");
  return `${parseInt(m, 10)}月`;
}

export default function CancellationsView({ monthlyRows, configured }: Props) {
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [overrides, setOverrides] = useState<OverridesMap>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setOverrides(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const monthlyCancellations = useMemo(() => {
    return monthlyRows.map(({ month, rows }) => {
      const cancelled = rows.filter((r) => {
        const overrideSub = overrides[r.id]?.subscriptionStatus;
        const effective = overrideSub ?? r.subscriptionStatus ?? "";
        return effective.includes("解約");
      });
      return { month, cancelled };
    });
  }, [monthlyRows, overrides]);

  const totalCount = monthlyCancellations.reduce(
    (s, { cancelled }) => s + cancelled.length,
    0,
  );

  const monthsWithData = monthlyCancellations.filter(({ cancelled }) => cancelled.length > 0);

  const allCancellations = useMemo(() => {
    const list = monthlyCancellations.flatMap(({ month, cancelled }) =>
      cancelled.map((row) => ({ month, row })),
    );
    return list;
  }, [monthlyCancellations]);

  const filtered = useMemo(() => {
    return allCancellations.filter(({ month, row }) => {
      if (monthFilter !== "all" && month !== monthFilter) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [
          row.clientName,
          row.subscriberId ?? "",
          row.payeeName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [allCancellations, q, monthFilter]);

  const latestMonthWithData =
    monthlyCancellations[monthlyCancellations.length - 1]?.cancelled.length ?? 0;

  return (
    <div>
      <TopBar
        title="解約一覧"
        subtitle={`直近 ${monthlyRows.length} ヶ月 · 累計解約 ${totalCount} 件 · 今月 ${latestMonthWithData} 件`}
      />
      <div className="p-6 space-y-6">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL_BILLING</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN_BILLING </code>
            を Vercel の環境変数に登録すると、請求書シートの実データがこの画面に反映されます。
          </div>
        )}

        {/* Monthly summary tiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-600" /> 月別解約数
            </h2>
            <div className="text-xs text-slate-500">継続列が「解約」を含む行を集計</div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {monthlyCancellations.map(({ month, cancelled }) => {
              const active = monthFilter === month;
              return (
                <button
                  key={month}
                  onClick={() =>
                    setMonthFilter((prev) => (prev === month ? "all" : month))
                  }
                  className={`card p-4 text-center transition-colors ${
                    active
                      ? "ring-2 ring-rose-400 bg-rose-50/50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs text-slate-500">
                    {monthLabel(month)}
                  </div>
                  <div
                    className={`text-2xl font-semibold mt-1 ${
                      cancelled.length > 0 ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {num(cancelled.length)}
                  </div>
                  <div className="text-xs text-slate-500">名</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter row */}
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
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">全期間</option>
            {monthlyCancellations
              .filter(({ cancelled }) => cancelled.length > 0)
              .map(({ month }) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
          </select>
          <div className="ml-auto text-xs text-slate-500">
            表示 {filtered.length} / 累計 {totalCount} 件
          </div>
        </div>

        {/* Detail table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">解約月</th>
                  <th className="text-left font-medium px-4 py-3">サロン名</th>
                  <th className="text-left font-medium px-4 py-3">加入者識別番号</th>
                  <th className="text-left font-medium px-4 py-3">振込名</th>
                  <th className="text-left font-medium px-4 py-3">継続</th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {totalCount === 0
                        ? "解約はまだ記録されていません。"
                        : "該当する解約が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filtered.map(({ month, row }) => {
                  const sub =
                    overrides[row.id]?.subscriptionStatus ??
                    row.subscriptionStatus ??
                    "";
                  const marketer =
                    overrides[row.id]?.marketer ?? row.marketer ?? "";
                  const note = overrides[row.id]?.note ?? row.note ?? "";
                  return (
                    <tr key={`${month}-${row.id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs">
                        <span className="pill bg-rose-50 text-rose-700">
                          {shortMonth(month)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.clientId ? (
                          <Link
                            href={`/clients/${row.clientId}`}
                            className="hover:text-brand-700"
                          >
                            {row.clientName}
                          </Link>
                        ) : (
                          row.clientName
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.payeeName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {sub || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {marketer || "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-slate-500 max-w-[280px] truncate"
                        title={note}
                      >
                        {note || "—"}
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
