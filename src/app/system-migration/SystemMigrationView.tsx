"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import { AlertTriangle, ArrowRightLeft, Filter, Search } from "lucide-react";
import { num } from "@/lib/format";
import type { SheetInvoice } from "@/lib/sheets";

const STORAGE_KEY = "sattou-system-migration";

type MigrationStatus = {
  completed: boolean;
  migrationDate: string; // YYYY-MM-DD (実施日)
  plannedDate: string; // YYYY-MM-DD (予定日)
};

type MigrationMap = Record<string, MigrationStatus>;

type Props = {
  rows: SheetInvoice[];
  month: string;
  configured: boolean;
  sheetName?: string;
  expectedSheets?: string[];
  sheetMatched?: boolean;
};

type StatusFilter = "all" | "completed" | "blank";

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

// クライアントの status を取り出す (存在しなければ既定値)
function getStatus(map: MigrationMap, key: string): MigrationStatus {
  const stored = map[key];
  return {
    completed: stored?.completed ?? false,
    migrationDate: stored?.migrationDate ?? "",
    plannedDate: stored?.plannedDate ?? "",
  };
}

export default function SystemMigrationView({
  rows,
  month,
  configured,
  sheetName,
  expectedSheets,
  sheetMatched,
}: Props) {
  const [migrations, setMigrations] = useState<MigrationMap>({});
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setMigrations(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((next: MigrationMap) => {
    setMigrations(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }, []);

  const toggleCompleted = useCallback(
    (clientName: string) => {
      setMigrations((prev) => {
        const current = getStatus(prev, clientName);
        const next = {
          ...prev,
          [clientName]: { ...current, completed: !current.completed },
        };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const setDate = useCallback(
    (clientName: string, date: string) => {
      setMigrations((prev) => {
        const current = getStatus(prev, clientName);
        const next = {
          ...prev,
          [clientName]: { ...current, migrationDate: date },
        };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const setPlannedDate = useCallback(
    (clientName: string, date: string) => {
      setMigrations((prev) => {
        const current = getStatus(prev, clientName);
        const next = {
          ...prev,
          [clientName]: { ...current, plannedDate: date },
        };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const status = getStatus(migrations, r.clientName);
      if (statusFilter === "completed" && !status.completed) return false;
      if (statusFilter === "blank" && status.completed) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = `${r.clientName} ${r.subscriberId ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, migrations, statusFilter, q]);

  const totals = useMemo(() => {
    let completed = 0;
    let blank = 0;
    for (const r of rows) {
      const s = getStatus(migrations, r.clientName);
      if (s.completed) completed++;
      else blank++;
    }
    return {
      total: rows.length,
      completed,
      blank,
      rate: rows.length > 0 ? (completed / rows.length) * 100 : 0,
    };
  }, [rows, migrations]);

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        title="新システム移行"
        subtitle={`${monthTitle(month)} · 全 ${rows.length} 社 / 表示 ${filtered.length} 社`}
      />
      <div className="shrink-0 p-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>

        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL_BILLING</code>{" "}
            と
            <code className="font-mono"> SHEETS_GAS_TOKEN_BILLING </code>
            を Vercel の環境変数に登録すると、請求書シートのクライアント一覧がこの画面に反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
          </div>
        )}

        {/* シート名の不一致警告 */}
        {configured && sheetName && sheetMatched === false && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-900 text-xs px-4 py-3 space-y-1">
            <div className="font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              シートタブ名が一致していません
            </div>
            <div className="leading-relaxed">
              GAS が返したタブ:
              <code className="font-mono ml-1 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                {sheetName}
              </code>
            </div>
            {expectedSheets && (
              <div className="text-[11px] text-rose-700 leading-relaxed">
                期待するタブ名 ({monthLabel(month)}分):{" "}
                {expectedSheets.map((n, i) => (
                  <code
                    key={i}
                    className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 ml-1 mt-1 inline-block"
                  >
                    {n}
                  </code>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総クライアント数</div>
            <div className="text-2xl font-semibold mt-1">
              {num(totals.total)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">移行完了</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600">
              {num(totals.completed)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-rose-600">未実施</div>
            <div className="text-2xl font-semibold mt-1 text-rose-700">
              {num(totals.blank)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">進捗率</div>
            <div className="text-2xl font-semibold mt-1 text-brand-700">
              {totals.rate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="クライアント名 / 識別番号で検索"
              className="input pl-9"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">状態すべて</option>
            <option value="completed">移行完了</option>
            <option value="blank">未実施</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="card h-full flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide shadow-sm">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-30 w-[240px] max-w-[240px]">
                    クライアント名
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[90px]">
                    ブランド数
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[90px]">
                    店舗数
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[110px]">
                    識別番号
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[140px]">
                    システム移行
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[160px]">
                    システム移行日
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[160px]">
                    システム移行予定日
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      表示できるクライアントがありません。
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const status = getStatus(migrations, r.clientName);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 font-medium truncate max-w-[240px]">
                        {r.clientName}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {r.brandCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {r.storeCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {r.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={status.completed}
                            onChange={() => toggleCompleted(r.clientName)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span
                            className={`pill ${
                              status.completed
                                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                            }`}
                          >
                            {status.completed ? "完了" : "未実施"}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={status.migrationDate}
                          onChange={(e) => setDate(r.clientName, e.target.value)}
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={status.plannedDate}
                          onChange={(e) =>
                            setPlannedDate(r.clientName, e.target.value)
                          }
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        />
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
