"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { ChevronLeft, MessageSquare } from "lucide-react";
import {
  STORAGE_KEY,
  ensureMonth,
  monthKey as buildMonthKey,
  monthLabel,
  type Store,
} from "../lib";

type Props = {
  year: number;
  month: number;
};

// 中身の項目仕様が確定するまではプレースホルダーの入力欄のみ表示する。
// ユーザーから入力項目 (氏名 / 会社名 / 連絡先 / 内容 / 対応状況など) が来次第、
// テーブル形式に差し替える。
export default function InquiryMonthView({ year, month }: Props) {
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

  const md = ensureMonth(store, key);

  return (
    <div>
      <TopBar
        title={`新規問い合わせ · ${monthLabel(year, month)}`}
        subtitle={`入力済 ${md.entries.length} 件 · 中身の入力項目は未確定です`}
      />
      <div className="p-6 space-y-4">
        {/* 月一覧へ戻る導線 */}
        <div className="flex items-center justify-between">
          <Link
            href="/inquiries"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-700"
          >
            <ChevronLeft className="w-4 h-4" />
            月一覧に戻る
          </Link>
        </div>

        {/* プレースホルダー: 中身の項目仕様が来たらテーブル + フォームに置き換える */}
        <section className="card p-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare className="w-4 h-4 text-brand-600" />
            {monthLabel(year, month)}
          </div>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-600 text-sm px-4 py-6 leading-relaxed">
            この月の問い合わせ入力ページです。
            <br />
            入力項目の仕様（例: 氏名 / 会社名 / 連絡先 / 問い合わせ内容 / 対応状況 など）が固まり次第、こちらに入力フォームと一覧テーブルを追加します。
          </div>
          <div className="text-[11px] text-slate-400">
            入力データはブラウザに自動保存される想定 (localStorage キー:{" "}
            <code className="font-mono">{STORAGE_KEY}</code>)
          </div>
        </section>
      </div>
    </div>
  );
}
