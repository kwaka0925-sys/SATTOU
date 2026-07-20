"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { ChevronLeft, MessageSquare, Plus, Trash2 } from "lucide-react";
import { num } from "@/lib/format";
import {
  STORAGE_KEY,
  RESULT_OPTIONS,
  CONTRACT_PLAN_OPTIONS,
  blankEntry,
  computeMonthStats,
  contractPlanPillClass,
  ensureMonth,
  monthKey as buildMonthKey,
  monthLabel,
  resultPillClass,
  type ContractPlan,
  type InquiryEntry,
  type InquiryResult,
  type Store,
} from "../lib";

type Props = {
  year: number;
  month: number;
};

function newId(): string {
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

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

  const persist = useCallback((next: Store) => {
    setStore(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  }, []);

  const md = useMemo(() => ensureMonth(store, key), [store, key]);
  const stats = useMemo(() => computeMonthStats(md), [md]);

  const updateEntry = useCallback(
    (entryId: string, patch: Partial<InquiryEntry>) => {
      const nextEntries = md.entries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      );
      persist({ ...store, [key]: { entries: nextEntries } });
    },
    [md.entries, store, key, persist],
  );

  const addEntry = useCallback(() => {
    const nowIso = new Date().toISOString();
    const entry: InquiryEntry = {
      id: newId(),
      ...blankEntry(),
      createdAt: nowIso,
    };
    const nextEntries = [...md.entries, entry];
    persist({ ...store, [key]: { entries: nextEntries } });
  }, [md.entries, store, key, persist]);

  const deleteEntry = useCallback(
    (entryId: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm("この問い合わせを削除しますか？")
      ) {
        return;
      }
      const nextEntries = md.entries.filter((e) => e.id !== entryId);
      persist({ ...store, [key]: { entries: nextEntries } });
    },
    [md.entries, store, key, persist],
  );

  return (
    <div>
      <TopBar
        title={`新規問い合わせ · ${monthLabel(year, month)}`}
        subtitle={`問い合わせ ${num(stats.total)} 件 · 契約 ${num(stats.contracted)} / 断り ${num(stats.declined)} / 検討 ${num(stats.considering)}`}
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
          <div className="text-xs text-slate-500">
            入力内容はブラウザに自動保存されます
          </div>
        </div>

        {/* 月別の集計 KPI。詳細画面でも確認できるように 4 枚並べる。 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="text-xs text-slate-500">問い合わせ数</div>
            <div className="text-xl font-semibold mt-0.5">
              {num(stats.total)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">契約数</div>
            <div className="text-xl font-semibold mt-0.5 text-emerald-700">
              {num(stats.contracted)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">断り数</div>
            <div className="text-xl font-semibold mt-0.5 text-rose-700">
              {num(stats.declined)}
            </div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">検討数</div>
            <div className="text-xl font-semibold mt-0.5 text-amber-700">
              {num(stats.considering)}
            </div>
          </div>
        </div>

        {/* エントリーテーブル (インライン編集 + 追加/削除) */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              {monthLabel(year, month)} の問い合わせ
            </h2>
            <button
              type="button"
              onClick={addEntry}
              className="btn-primary inline-flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              問い合わせを追加
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="text-slate-500 text-xs uppercase tracking-wide bg-slate-50">
                <tr>
                  <th className="text-left font-medium px-3 py-2 min-w-[180px]">
                    面談日時
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[140px]">
                    お名前
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[140px]">
                    電話番号
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[200px]">
                    メールアドレス
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[240px]">
                    問い合わせ内容
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[200px]">
                    メモ
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[130px]">
                    面談結果
                  </th>
                  <th className="text-left font-medium px-3 py-2 min-w-[160px]">
                    契約プラン
                  </th>
                  <th className="text-left font-medium px-3 py-2 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {md.entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      まだ問い合わせがありません。「問い合わせを追加」から入力を始めてください。
                    </td>
                  </tr>
                )}
                {md.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <input
                        type="datetime-local"
                        value={e.meetingDateTime}
                        onChange={(ev) =>
                          updateEntry(e.id, {
                            meetingDateTime: ev.target.value,
                          })
                        }
                        className="input text-xs w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={e.name}
                        onChange={(ev) =>
                          updateEntry(e.id, { name: ev.target.value })
                        }
                        placeholder="山田 太郎"
                        className="input text-sm w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="tel"
                        value={e.phone}
                        onChange={(ev) =>
                          updateEntry(e.id, { phone: ev.target.value })
                        }
                        placeholder="090-0000-0000"
                        className="input text-sm w-full tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="email"
                        value={e.email}
                        onChange={(ev) =>
                          updateEntry(e.id, { email: ev.target.value })
                        }
                        placeholder="name@example.com"
                        className="input text-sm w-full font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={e.content}
                        onChange={(ev) =>
                          updateEntry(e.id, { content: ev.target.value })
                        }
                        placeholder="問い合わせフォームの本文"
                        rows={2}
                        className="input text-sm w-full resize-y min-h-[38px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={e.note}
                        onChange={(ev) =>
                          updateEntry(e.id, { note: ev.target.value })
                        }
                        placeholder="対応時のメモ"
                        rows={2}
                        className="input text-sm w-full resize-y min-h-[38px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={e.result}
                        onChange={(ev) => {
                          const next = ev.target.value as InquiryResult;
                          // 契約以外に切り替えた時は契約プランを自動で消す。
                          // 契約プラン欄が使えるのは面談結果 = 契約 の時だけ、という
                          // ルールを保存側でも維持する。
                          const patch: Partial<InquiryEntry> = { result: next };
                          if (next !== "契約") patch.contractPlan = "";
                          updateEntry(e.id, patch);
                        }}
                        className={`input text-sm w-full font-medium ${resultPillClass(e.result)}`}
                      >
                        <option value="" className="bg-white text-slate-900">
                          未設定
                        </option>
                        {RESULT_OPTIONS.map((r) => (
                          <option
                            key={r}
                            value={r}
                            className="bg-white text-slate-900"
                          >
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {/* 契約プランは面談結果 = 契約 の時だけ選択できる。
                          それ以外の行では列の存在は保ちつつ中身を空にする。 */}
                      {e.result === "契約" ? (
                        <select
                          value={e.contractPlan ?? ""}
                          onChange={(ev) =>
                            updateEntry(e.id, {
                              contractPlan: ev.target.value as ContractPlan,
                            })
                          }
                          className={`input text-sm w-full font-medium ${contractPlanPillClass(
                            (e.contractPlan ?? "") as ContractPlan,
                          )}`}
                        >
                          <option value="" className="bg-white text-slate-900">
                            未選択
                          </option>
                          {CONTRACT_PLAN_OPTIONS.map((p) => (
                            <option
                              key={p}
                              value={p}
                              className="bg-white text-slate-900"
                            >
                              {p}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 text-xs"
                        title="この問い合わせを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
