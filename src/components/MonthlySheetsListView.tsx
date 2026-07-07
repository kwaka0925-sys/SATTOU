"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "./TopBar";
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  basePath: string; // 例: "/invoicing-sheet"
  storageKey: string; // 例: "sattou-invoicing-sheets"
  year: number;
};

type MonthlyUrls = Record<string, string>; // "YYYY-MM" -> URL

export default function MonthlySheetsListView({
  title,
  subtitle,
  basePath,
  storageKey,
  year,
}: Props) {
  const [urls, setUrls] = useState<MonthlyUrls>({});
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") setUrls(parsed);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const persist = (next: MonthlyUrls) => {
    setUrls(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  };

  const startEdit = (month: string) => {
    setEditingMonth(month);
    setEditValue(urls[month] ?? "");
  };

  const saveEdit = () => {
    if (!editingMonth) return;
    const url = editValue.trim();
    const next = { ...urls };
    if (url) next[editingMonth] = url;
    else delete next[editingMonth];
    persist(next);
    setEditingMonth(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingMonth(null);
    setEditValue("");
  };

  const deleteMonth = (month: string) => {
    const monthNum = parseInt(month.split("-")[1], 10);
    if (!window.confirm(`${monthNum}月の URL を削除しますか？`)) return;
    const next = { ...urls };
    delete next[month];
    persist(next);
  };

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const key = `${year}-${String(m).padStart(2, "0")}`;
      return { m, key, url: urls[key] };
    });
  }, [year, urls]);

  const registeredCount = months.filter((m) => m.url).length;

  return (
    <div>
      <TopBar
        title={title}
        subtitle={`${year}年 · ${subtitle} · 登録済み ${registeredCount} / 12 月`}
      />
      <div className="p-6 space-y-4">
        {/* 年切替 */}
        <div className="card p-3 flex items-center justify-center gap-4">
          <Link
            href={`${basePath}?year=${year - 1}`}
            className="btn-ghost text-sm inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {year - 1}年
          </Link>
          <div className="font-semibold text-lg">{year}年</div>
          <Link
            href={`${basePath}?year=${year + 1}`}
            className="btn-ghost text-sm inline-flex items-center gap-1"
          >
            {year + 1}年 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 12ヶ月タイル */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {months.map((m) => (
            <div key={m.key} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg">{m.m}月</div>
                {m.url ? (
                  <span className="pill bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 text-[10px]">
                    登録済
                  </span>
                ) : (
                  <span className="pill bg-slate-100 text-slate-500 ring-1 ring-slate-200 text-[10px]">
                    未登録
                  </span>
                )}
              </div>
              {m.url ? (
                <>
                  <div
                    className="text-[10px] text-slate-400 font-mono truncate"
                    title={m.url}
                  >
                    {m.url}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Link
                      href={`${basePath}/${m.key}`}
                      className="btn-primary text-xs inline-flex items-center gap-1 flex-1 justify-center"
                    >
                      開く <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => startEdit(m.key)}
                      className="text-slate-500 hover:text-brand-700 p-1.5 rounded-md hover:bg-slate-100"
                      title="URLを編集"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMonth(m.key)}
                      className="text-slate-500 hover:text-rose-600 p-1.5 rounded-md hover:bg-slate-100"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-400 flex-1 flex items-center">
                    URLが未登録
                  </div>
                  <button
                    onClick={() => startEdit(m.key)}
                    className="btn-primary text-xs mt-2 inline-flex items-center gap-1 justify-center"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> URL登録
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 編集ダイアログ */}
      {editingMonth && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={cancelEdit}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg">
              {parseInt(editingMonth.split("-")[1], 10)}月のスプレッドシートURL
            </h3>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="input w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={cancelEdit} className="btn-ghost">
                キャンセル
              </button>
              <button onClick={saveEdit} className="btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
