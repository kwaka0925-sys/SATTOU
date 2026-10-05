"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { ChevronLeft, ExternalLink, Users } from "lucide-react";
import { yen } from "@/lib/format";
import {
  STORAGE_KEY,
  SLOTS_PER_MONTH,
  ensureMonth,
  parseAmount,
  monthKey as buildMonthKey,
  monthLabel,
  type Slot,
  type Store,
} from "../lib";

type Props = {
  year: number;
  month: number;
};

export default function ShareholderMonthView({ year, month }: Props) {
  const [store, setStore] = useState<Store>({});
  const key = buildMonthKey(year, month);

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

  const md = useMemo(() => ensureMonth(store, key), [store, key]);

  const updateSlot = (slotIndex: number, patch: Partial<Slot>) => {
    const nextSlots = md.slots.map((s, i) =>
      i === slotIndex ? { ...s, ...patch } : s,
    );
    persist({ ...store, [key]: { slots: nextSlots } });
  };

  const monthTotal = md.slots.reduce(
    (acc, s) => acc + parseAmount(s.amount),
    0,
  );
  const monthPaid = md.slots.reduce(
    (acc, s) => acc + (s.paid ? parseAmount(s.amount) : 0),
    0,
  );
  const monthUnpaid = monthTotal - monthPaid;

  return (
    <div>
      <TopBar
        title={`株主用請求書 · ${monthLabel(year, month)}`}
        subtitle={`${SLOTS_PER_MONTH} クライアント分の枠 · 月合計 ${yen(monthTotal)} (入金済 ${yen(monthPaid)} / 未入金 ${yen(monthUnpaid)})`}
      />
      <div className="p-6 space-y-4">
        {/* 月一覧へ戻る導線 */}
        <div className="flex items-center justify-between">
          <Link
            href="/shareholder-invoices"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-700"
          >
            <ChevronLeft className="w-4 h-4" />
            月一覧に戻る
          </Link>
          <div className="text-xs text-slate-500">
            入力内容はブラウザに自動保存されます
          </div>
        </div>

        {/* 3 クライアント枠のテーブル (見え方は元のスクショと同じ) */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              {monthLabel(year, month)}
            </h2>
            <div className="text-xs text-slate-500">
              月合計 <span className="font-medium text-slate-700">{yen(monthTotal)}</span>
              <span className="mx-1">·</span>
              入金済 <span className="text-emerald-700">{yen(monthPaid)}</span>
              <span className="mx-1">·</span>
              未入金 <span className="text-amber-700">{yen(monthUnpaid)}</span>
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
                  <th className="text-left font-medium px-3 py-2 min-w-[320px]">
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
                          updateSlot(i, { clientName: e.target.value })
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
                            updateSlot(i, { amount: e.target.value })
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
                            updateSlot(i, { paid: e.target.checked })
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
                            updateSlot(i, { sheetUrl: e.target.value })
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
      </div>
    </div>
  );
}
