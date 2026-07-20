"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { MessageSquare, X } from "lucide-react";
import { num } from "@/lib/format";
import {
  STORAGE_KEY,
  computeMonthStats,
  displayMonths,
  ensureMonth,
  normalizeStore,
  resultPillClass,
  type InquiryEntry,
  type InquiryResult,
  type MonthStats,
  type Store,
} from "./lib";

// KPI タイルからクリックで開ける絞り込み種別。
type FilterableResult = "契約" | "断り" | "検討" | "キャンセル";

// meetingDateTime ("YYYY-MM-DDTHH:MM") を "YYYY/MM/DD HH:MM" 表記に。
// 空文字は「日時未定」。
function formatMeetingDateTime(v: string): string {
  const s = (v || "").trim();
  if (!s) return "日時未定";
  return s.replace("T", " ").replace(/-/g, "/");
}

export default function InquiriesView() {
  const [store, setStore] = useState<Store>({});
  // 選択中の絞り込み。同じタイルを再クリックで閉じる、
  // 別のタイルをクリックで切替。
  const [activeFilter, setActiveFilter] = useState<FilterableResult | null>(
    null,
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;
      // 既存データを月キーと meetingDateTime の整合が取れる形に正規化。
      // 差分があれば localStorage にも書き戻す。
      const normalized = normalizeStore(parsed as Store);
      setStore(normalized);
      if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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

  // 全期間の全エントリーを平坦化。所属月キーとラベルを付与しておく。
  const allEntries = useMemo(() => {
    const list: Array<{
      monthKey: string;
      monthLabel: string;
      entry: InquiryEntry;
    }> = [];
    for (const m of months) {
      const md = ensureMonth(store, m.key);
      for (const e of md.entries) {
        list.push({ monthKey: m.key, monthLabel: m.label, entry: e });
      }
    }
    return list;
  }, [months, store]);

  // KPI で選ばれた結果に一致する行を、面談日時昇順で。
  const filteredEntries = useMemo(() => {
    if (!activeFilter) return [];
    return allEntries
      .filter(({ entry }) => entry.result === activeFilter)
      .sort((a, b) => {
        const at = (a.entry.meetingDateTime || "").trim();
        const bt = (b.entry.meetingDateTime || "").trim();
        if (!at && !bt) return 0;
        if (!at) return 1;
        if (!bt) return -1;
        return at.localeCompare(bt);
      });
  }, [allEntries, activeFilter]);

  const toggleFilter = (v: FilterableResult) =>
    setActiveFilter((prev) => (prev === v ? null : v));

  // 絞り込み用ボタンの共通スタイル生成。active 時はリング表示。
  // タイルが 6 枚並ぶので余白を控えめに (px-3 py-2)。
  const filterBtnClass = (v: FilterableResult, activeRing: string) =>
    `card px-3 py-2 text-left w-full transition-colors hover:bg-slate-50 ${
      activeFilter === v ? activeRing : ""
    }`;

  // 成約率 = 成約数 (契約) ÷ 問い合わせ数。総数 0 の時は "—"。
  const conversionRateLabel =
    overall.total > 0
      ? `${Math.round((overall.contracted / overall.total) * 100)}%`
      : "—";

  return (
    <div>
      <TopBar
        title="新規問い合わせ"
        subtitle={`2026年5月〜2027年4月 · 全期間合計 問い合わせ ${overall.total} / 成約 ${overall.contracted} (${conversionRateLabel}) / 断り ${overall.declined} / 検討 ${overall.considering} / キャンセル ${overall.cancelled}`}
      />
      <div className="p-6 space-y-4">
        {/* 期間合計 KPI — 6 枚並ぶので余白は控えめ。
            成約/断り/検討/キャンセル はクリックで下に内訳を展開する。 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="card px-3 py-2">
            <div className="text-xs text-slate-500">問い合わせ数</div>
            <div className="text-xl font-semibold mt-0.5">
              {num(overall.total)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFilter("契約")}
            className={filterBtnClass(
              "契約",
              "ring-2 ring-emerald-400 bg-emerald-50/40",
            )}
          >
            <div className="text-xs text-slate-500">成約数</div>
            <div className="text-xl font-semibold mt-0.5 text-emerald-700">
              {num(overall.contracted)}
            </div>
          </button>
          {/* 成約率タイルは絞り込みボタンではない (集計値なのでフィルタ対象にならない) */}
          <div className="card px-3 py-2">
            <div className="text-xs text-slate-500">成約率</div>
            <div className="text-xl font-semibold mt-0.5 text-brand-700 tabular-nums">
              {conversionRateLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFilter("断り")}
            className={filterBtnClass(
              "断り",
              "ring-2 ring-rose-400 bg-rose-50/40",
            )}
          >
            <div className="text-xs text-slate-500">断り数</div>
            <div className="text-xl font-semibold mt-0.5 text-rose-700">
              {num(overall.declined)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => toggleFilter("検討")}
            className={filterBtnClass(
              "検討",
              "ring-2 ring-amber-400 bg-amber-50/40",
            )}
          >
            <div className="text-xs text-slate-500">検討数</div>
            <div className="text-xl font-semibold mt-0.5 text-amber-700">
              {num(overall.considering)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => toggleFilter("キャンセル")}
            className={filterBtnClass(
              "キャンセル",
              "ring-2 ring-zinc-400 bg-zinc-100/60",
            )}
          >
            <div className="text-xs text-slate-500">キャンセル数</div>
            <div className="text-xl font-semibold mt-0.5 text-zinc-700">
              {num(overall.cancelled)}
            </div>
          </button>
        </div>

        {/* KPI が選ばれている時だけ表示する内訳リスト。
            月ラベルはリンク化して当該月の詳細ページに飛べるようにする。 */}
        {activeFilter && (
          <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`pill ${resultPillClass(activeFilter as InquiryResult)}`}
                >
                  {activeFilter}
                </span>
                <h2 className="font-semibold">
                  全期間の{activeFilter}
                  <span className="text-slate-500 font-normal ml-2 text-sm">
                    {filteredEntries.length} 件
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilter(null)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                aria-label="閉じる"
              >
                <X className="w-3.5 h-3.5" />
                閉じる
              </button>
            </div>
            {filteredEntries.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">
                該当する問い合わせはまだありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">月</th>
                      <th className="text-left font-medium px-3 py-2">
                        面談日時
                      </th>
                      <th className="text-left font-medium px-3 py-2">
                        お名前
                      </th>
                      <th className="text-left font-medium px-3 py-2">
                        電話番号
                      </th>
                      <th className="text-left font-medium px-3 py-2">
                        メールアドレス
                      </th>
                      {activeFilter === "契約" && (
                        <>
                          <th className="text-left font-medium px-3 py-2">
                            プラン
                          </th>
                          <th className="text-left font-medium px-3 py-2">
                            店舗数
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map(({ monthKey, monthLabel, entry }) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link
                            href={`/inquiries/${monthKey}`}
                            className="text-brand-700 hover:underline text-xs"
                          >
                            {monthLabel}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                          {formatMeetingDateTime(entry.meetingDateTime)}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {entry.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                          {entry.phone || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                          {entry.email || "—"}
                        </td>
                        {activeFilter === "契約" && (
                          <>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {entry.contractPlan || "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">
                              {entry.storeCount && entry.storeCount > 0
                                ? `${entry.storeCount}店舗`
                                : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

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
