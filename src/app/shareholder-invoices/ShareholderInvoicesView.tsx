"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { yen, num } from "@/lib/format";
import {
  STORAGE_KEY,
  SLOTS_PER_MONTH,
  ensureMonth,
  parseAmount,
  displayMonths,
  monthKey,
  monthLabel,
  type Store,
} from "./lib";

type Props = {
  year: number;
};

export default function ShareholderInvoicesView({ year: initialYear }: Props) {
  const [store, setStore] = useState<Store>({});
  const [year, setYear] = useState(initialYear);

  // localStorage から読み込み。同一年でも別月のタイル間で共通なので、
  // ここで一度読めばそれぞれのタイルが自分の月分を切り出す。
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

  const months = useMemo(
    () =>
      displayMonths(year).map((m) => ({
        m,
        key: monthKey(year, m),
        label: monthLabel(year, m),
      })),
    [year],
  );

  // 全月合計・入金済み合計・入力済スロット数の集計。
  // クライアント名は既定値で埋めているので「入力済」判定には使えない。
  // 金額 / 入金チェック / スプシ URL のいずれかがユーザー由来なら「入力済」扱い。
  const totals = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let entries = 0;
    for (const { key } of months) {
      const md = ensureMonth(store, key);
      md.slots.forEach((s) => {
        const amt = parseAmount(s.amount);
        const engaged = amt > 0 || s.paid || !!s.sheetUrl;
        if (!engaged) return;
        entries++;
        totalAmount += amt;
        if (s.paid) paidAmount += amt;
      });
    }
    return {
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
      entries,
    };
  }, [months, store]);

  return (
    <div>
      <TopBar
        title="株主用請求書"
        subtitle={`${year}年 · 月別 ${SLOTS_PER_MONTH} 枠 · 入力済 ${totals.entries} 件`}
      />
      <div className="p-6 space-y-4">
        {/* 年切り替え + 説明 */}
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
            月タイルをクリックすると入力ページが開きます (各月 {SLOTS_PER_MONTH}{" "}
            クライアント分)
          </div>
        </div>

        {/* 集計 KPI */}
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

        {/* 月タイル (5月〜12月) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {months.map(({ m, key, label }) => {
            const md = ensureMonth(store, key);
            // 入金件数 = 入金チェック ON の枠。
            // 未入金件数 = 入金チェック OFF かつ金額 or URL が入っている枠
            //   (何も触っていない完全な空枠は「未入金」ではなく「未入力」扱いとして数えない)。
            const paidCount = md.slots.filter((s) => s.paid).length;
            const unpaidCount = md.slots.filter(
              (s) => !s.paid && (parseAmount(s.amount) > 0 || !!s.sheetUrl),
            ).length;
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
              <Link
                key={key}
                href={`/shareholder-invoices/${key}`}
                className="card p-4 space-y-2 hover:bg-slate-50 hover:border-brand-300 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold group-hover:text-brand-700">
                    <Users className="w-4 h-4 text-brand-600" />
                    {label}
                  </div>
                  {/* 入金/未入金の件数バッジ。0 件でも並べて表示することで
                      全月同じ見た目に揃える。 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
                      {paidCount}件入金
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
                      {unpaidCount}件未入金
                    </span>
                  </div>
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {yen(monthTotal)}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-700">
                    入金済 {yen(monthPaid)}
                  </span>
                  <span className="text-amber-700">
                    未入金 {yen(monthUnpaid)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
