"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Users,
} from "lucide-react";
import { yen, num } from "@/lib/format";

// 株主向け請求書。1 月あたり 3 クライアント固定の枠を用意し、
// クライアント名・請求金額・入金状況・請求書スプシ URL を月別に管理する。
// すべてブラウザ localStorage に保存 (クライアントごとの権限管理はしない前提)。

const STORAGE_KEY = "sattou-shareholder-invoices";
const SLOTS_PER_MONTH = 3;

type Slot = {
  clientName: string;
  amount: string; // 入力の途中を保持したいので string で持ち、集計時に number 化する
  paid: boolean;
  sheetUrl: string;
};

type MonthData = { slots: Slot[] };

// キーは "YYYY-MM"。値は 3 枠固定のスロット配列。
type Store = Record<string, MonthData>;

type Props = {
  year: number;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function emptyMonth(): MonthData {
  return {
    slots: Array.from({ length: SLOTS_PER_MONTH }, () => ({
      clientName: "",
      amount: "",
      paid: false,
      sheetUrl: "",
    })),
  };
}

function ensureMonth(store: Store, key: string): MonthData {
  const existing = store[key];
  if (!existing || !Array.isArray(existing.slots)) return emptyMonth();
  const slots = [...existing.slots];
  while (slots.length < SLOTS_PER_MONTH) {
    slots.push({ clientName: "", amount: "", paid: false, sheetUrl: "" });
  }
  return { slots: slots.slice(0, SLOTS_PER_MONTH) };
}

function parseAmount(v: string): number {
  const cleaned = v.replace(/[¥,\s円]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function ShareholderInvoicesView({ year: initialYear }: Props) {
  const [store, setStore] = useState<Store>({});
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") setStore(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: Store) => {
    setStore(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  };

  const updateSlot = (
    monthKey: string,
    slotIndex: number,
    patch: Partial<Slot>,
  ) => {
    const current = ensureMonth(store, monthKey);
    const nextSlots = current.slots.map((s, i) =>
      i === slotIndex ? { ...s, ...patch } : s,
    );
    persist({ ...store, [monthKey]: { slots: nextSlots } });
  };

  const months = useMemo(
    () =>
      MONTHS.map((m) => ({
        m,
        key: `${year}-${String(m).padStart(2, "0")}`,
        label: `${year}年${m}月`,
      })),
    [year],
  );

  const totals = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    let entries = 0;
    for (const { key } of months) {
      const md = ensureMonth(store, key);
      md.slots.forEach((s) => {
        const amt = parseAmount(s.amount);
        if (!s.clientName && amt === 0) return;
        entries++;
        totalAmount += amt;
        if (s.paid) paidAmount += amt;
        else unpaidAmount += amt;
      });
    }
    return { totalAmount, paidAmount, unpaidAmount, entries };
  }, [months, store]);

  return (
    <div>
      <TopBar
        title="株主用請求書"
        subtitle={`${year}年 · 月別 ${SLOTS_PER_MONTH} 枠 · 入力済 ${totals.entries} 件`}
      />
      <div className="p-6 space-y-4">
        {/* 年切り替え + KPI */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
              title="前の年"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-lg">{year}年</div>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
              title="次の年"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-slate-500">
            各月に {SLOTS_PER_MONTH} クライアント分の枠があります
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="text-xs text-slate-500">請求総額</div>
            <div className="text-xl font-semibold mt-0.5">
              {yen(totals.totalAmount)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">入金済み</div>
            <div className="text-xl font-semibold mt-0.5 text-emerald-700">
              {yen(totals.paidAmount)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">未入金</div>
            <div className="text-xl font-semibold mt-0.5 text-amber-600">
              {yen(totals.unpaidAmount)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">入力済 件数</div>
            <div className="text-xl font-semibold mt-0.5">
              {num(totals.entries)}
            </div>
          </div>
        </div>

        {/* 月別カード */}
        <div className="space-y-4">
          {months.map(({ m, key, label }) => {
            const md = ensureMonth(store, key);
            const monthTotal = md.slots.reduce(
              (acc, s) => acc + parseAmount(s.amount),
              0,
            );
            const monthPaid = md.slots.reduce(
              (acc, s) => acc + (s.paid ? parseAmount(s.amount) : 0),
              0,
            );
            return (
              <section key={key} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-600" />
                    {label}
                  </h2>
                  <div className="text-xs text-slate-500">
                    月合計 <span className="font-medium text-slate-700">{yen(monthTotal)}</span>
                    <span className="mx-1">·</span>
                    入金済 <span className="text-emerald-700">{yen(monthPaid)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead className="text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left font-medium px-3 py-2 w-[60px]">#</th>
                        <th className="text-left font-medium px-3 py-2 min-w-[200px]">
                          クライアント名
                        </th>
                        <th className="text-left font-medium px-3 py-2 min-w-[160px]">
                          請求金額
                        </th>
                        <th className="text-left font-medium px-3 py-2 min-w-[180px]">
                          入金状況
                        </th>
                        <th className="text-left font-medium px-3 py-2 min-w-[280px]">
                          請求書スプレッドシート URL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {md.slots.map((slot, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={slot.clientName}
                              onChange={(e) =>
                                updateSlot(key, i, { clientName: e.target.value })
                              }
                              placeholder={`クライアント${i + 1} を入力`}
                              className="input text-sm w-full"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">¥</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={slot.amount}
                                onChange={(e) =>
                                  updateSlot(key, i, { amount: e.target.value })
                                }
                                placeholder="0"
                                className="input text-sm tabular-nums w-full"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <label
                              className={`inline-flex items-center gap-2 cursor-pointer select-none rounded-md px-3 py-1.5 border ${
                                slot.paid
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={slot.paid}
                                onChange={(e) =>
                                  updateSlot(key, i, { paid: e.target.checked })
                                }
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs font-medium">
                                {slot.paid ? "入金済み" : "未入金"}
                              </span>
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="url"
                                value={slot.sheetUrl}
                                onChange={(e) =>
                                  updateSlot(key, i, { sheetUrl: e.target.value })
                                }
                                placeholder="https://docs.google.com/spreadsheets/..."
                                className="input text-xs w-full font-mono"
                              />
                              {slot.sheetUrl && (
                                <a
                                  href={slot.sheetUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="shrink-0 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline whitespace-nowrap"
                                  title="スプレッドシートを開く"
                                >
                                  開く <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
