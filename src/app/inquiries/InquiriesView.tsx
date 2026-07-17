"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { MessageSquare } from "lucide-react";
import { num } from "@/lib/format";
import {
  STORAGE_KEY,
  displayMonths,
  ensureMonth,
  type Store,
} from "./lib";

export default function InquiriesView() {
  const [store, setStore] = useState<Store>({});

  // localStorage から復元。中身の項目仕様が来たら InquiryEntry を拡張していく。
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

  // 期間全体 (2026-05 〜 2027-04) の入力済み件数集計。
  const totalEntries = useMemo(() => {
    let n = 0;
    for (const m of months) {
      n += ensureMonth(store, m.key).entries.length;
    }
    return n;
  }, [months, store]);

  return (
    <div>
      <TopBar
        title="新規問い合わせ"
        subtitle={`2026年5月〜2027年4月 · 全 ${months.length} ヶ月 · 入力済 ${totalEntries} 件`}
      />
      <div className="p-6 space-y-4">
        <div className="text-xs text-slate-500 flex items-center justify-between">
          <div>月タイルをクリックすると入力ページが開きます。</div>
          <div>
            期間: <span className="font-medium text-slate-700">2026-05 〜 2027-04</span>
          </div>
        </div>

        {/* 月タイル 12 ヶ月 (2026-05 〜 2027-04) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {months.map(({ key, label }) => {
            const md = ensureMonth(store, key);
            const count = md.entries.length;
            return (
              <Link
                key={key}
                href={`/inquiries/${key}`}
                className="card p-4 space-y-2 hover:bg-slate-50 hover:border-brand-300 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold group-hover:text-brand-700">
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    {label}
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                      count > 0
                        ? "bg-brand-50 text-brand-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {num(count)} 件
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {count === 0 ? "まだ問い合わせ未登録" : `${count} 件の問い合わせ`}
                </div>
              </Link>
            );
          })}
        </div>

        {/* 中身の項目定義がまだのため、ページ下部に案内。 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3 leading-relaxed">
          問い合わせページの入力項目 (氏名 / 会社名 / 連絡先 / 内容 / 対応状況 等) は現在未確定です。仕様が固まり次第、各月ページに入力フォームを追加します。
        </div>
      </div>
    </div>
  );
}
