"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { MessageSquare } from "lucide-react";
import { num } from "@/lib/format";
import {
  STORAGE_KEY,
  computeMonthStats,
  displayMonths,
  ensureMonth,
  type MonthStats,
  type Store,
} from "./lib";

export default function InquiriesView() {
  const [store, setStore] = useState<Store>({});

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

  const months = useMemo(() => displayMonths(), []);

  // 期間全体 (2026-05 〜 2027-04) の集計。ページ上部の KPI サマリー用。
  const overall = useMemo<MonthStats>(() => {
    let total = 0;
    let contracted = 0;
    let declined = 0;
    let considering = 0;
    let cancelled = 0;
    for (const m of months) {
      const s = computeMonthStats(ensureMonth(store, m.key));
      total += s.total;
      contracted += s.contracted;
      declined += s.declined;
      considering += s.considering;
      cancelled += s.cancelled;
    }
    return { total, contracted, declined, considering, cancelled };
  }, [months, store]);

  return (
    <div>
      <TopBar
        title="新規問い合わせ"
        subtitle={`2026年5月〜2027年4月 · 全期間合計 問い合わせ ${overall.total} / 契約 ${overall.contracted} / 断り ${overall.declined} / 検討 ${overall.considering} / キャンセル ${overall.cancelled}`}
      />
      <div className="p-6 space-y-4">
        {/* 期間合計 KPI — 開くたびに一目で分かるように 5 枚並べる。 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3">
            <div className="text-xs text-slate-500">問い合わせ数</div>
            <div className="text-xl font-semibold mt-0.5">
              {num(overall.total)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">契約数</div>
            <div className="text-xl font-semibold mt-0.5 text-emerald-700">
              {num(overall.contracted)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">断り数</div>
            <div className="text-xl font-semibold mt-0.5 text-rose-700">
              {num(overall.declined)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">検討数</div>
            <div className="text-xl font-semibold mt-0.5 text-amber-700">
              {num(overall.considering)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">キャンセル数</div>
            <div className="text-xl font-semibold mt-0.5 text-zinc-700">
              {num(overall.cancelled)}
            </div>
          </div>
        </div>

        {/* 月タイル 12 ヶ月 (2026-05 〜 2027-04)。各タイルに月別集計を並べる。 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {months.map(({ key, label }) => {
            const md = ensureMonth(store, key);
            const s = computeMonthStats(md);
            return (
              <Link
                key={key}
                href={`/inquiries/${key}`}
                className="card p-4 space-y-3 hover:bg-slate-50 hover:border-brand-300 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold group-hover:text-brand-700">
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    {label}
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                      s.total > 0
                        ? "bg-brand-50 text-brand-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    問い合わせ {num(s.total)}
                  </span>
                </div>
                {/* 面談結果の 4 分類を並べて表示。0 件でもラベル表示することで
                    「全月同じ見た目」に揃える。 */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-1.5 text-center">
                    <div className="text-[10px] text-emerald-700">契約</div>
                    <div className="text-base font-semibold tabular-nums">
                      {num(s.contracted)}
                    </div>
                  </div>
                  <div className="rounded-md bg-rose-50 text-rose-800 px-2 py-1.5 text-center">
                    <div className="text-[10px] text-rose-700">断り</div>
                    <div className="text-base font-semibold tabular-nums">
                      {num(s.declined)}
                    </div>
                  </div>
                  <div className="rounded-md bg-amber-50 text-amber-800 px-2 py-1.5 text-center">
                    <div className="text-[10px] text-amber-700">検討</div>
                    <div className="text-base font-semibold tabular-nums">
                      {num(s.considering)}
                    </div>
                  </div>
                  <div className="rounded-md bg-zinc-100 text-zinc-800 px-2 py-1.5 text-center">
                    <div className="text-[10px] text-zinc-600">キャンセル</div>
                    <div className="text-base font-semibold tabular-nums">
                      {num(s.cancelled)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
