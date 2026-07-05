"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { Check, ExternalLink, Filter, Search } from "lucide-react";
import type { StoreRow } from "./page";

type CancelFilter = "all" | "継続" | "解約";
type LegacyFilter = "all" | "yes" | "no";

type Props = {
  rows: StoreRow[];
  configured: boolean;
  sheetName?: string;
  month: string;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

const CANCELLED_STORAGE_KEY = "sattou-cancelled-stores";

function rowKey(r: StoreRow): string {
  return r.identifier || r.clientName || String(r.order);
}

export default function StoresView({ rows, configured, sheetName, month }: Props) {
  const [q, setQ] = useState("");
  const [cancel, setCancel] = useState<CancelFilter>("all");
  const [legacy, setLegacy] = useState<LegacyFilter>("all");
  const [marketer, setMarketer] = useState<string>("all");
  const [cancelledSet, setCancelledSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CANCELLED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCancelledSet(new Set(parsed));
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const toggleCancelled = (key: string) => {
    setCancelledSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(
          CANCELLED_STORAGE_KEY,
          JSON.stringify([...next]),
        );
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const marketers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.marketer).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const isCancelled = cancelledSet.has(rowKey(r));
      if (cancel === "解約" && !isCancelled) return false;
      if (cancel === "継続" && isCancelled) return false;
      if (legacy === "yes" && !r.legacyUser) return false;
      if (legacy === "no" && r.legacyUser) return false;
      if (marketer !== "all" && r.marketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [r.clientName, r.identifier].join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, cancel, legacy, marketer, cancelledSet]);

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + 1,
      cancelled: acc.cancelled + (cancelledSet.has(rowKey(r)) ? 1 : 0),
      legacy: acc.legacy + (r.legacyUser ? 1 : 0),
      hpb: acc.hpb + (r.hpbLinked === "連携" || r.hpbLinked === "✓" ? 1 : 0),
    }),
    { total: 0, cancelled: 0, legacy: 0, hpb: 0 },
  );

  return (
    <div>
      <TopBar
        title="sattou導入店舗"
        subtitle={
          sheetName
            ? `${sheetName} · 全 ${rows.length} 店舗 / 表示 ${filtered.length} 店舗`
            : `全 ${rows.length} 店舗 / 表示 ${filtered.length} 店舗`
        }
      />
      <div className="p-6 space-y-4">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN </code>
            を Vercel の環境変数に登録すると、導入店舗シートの実データが反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。<code className="font-mono">?month=YYYY-MM</code> で別の月を指定できます。
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総店舗数</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.total)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">解約</div>
            <div className="text-2xl font-semibold mt-1 text-rose-600">{num(totals.cancelled)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">旧SATTOUユーザ</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.legacy)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">HPB連携</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.hpb)}</div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 識別子で検索"
              className="input pl-9"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={cancel}
            onChange={(e) => setCancel(e.target.value as CancelFilter)}
            className="input w-auto"
          >
            <option value="all">解約すべて</option>
            <option value="継続">継続</option>
            <option value="解約">解約</option>
          </select>
          <select
            value={legacy}
            onChange={(e) => setLegacy(e.target.value as LegacyFilter)}
            className="input w-auto"
          >
            <option value="all">旧SATTOUすべて</option>
            <option value="yes">旧SATTOUユーザ</option>
            <option value="no">新規</option>
          </select>
          {marketers.length > 0 && (
            <select
              value={marketer}
              onChange={(e) => setMarketer(e.target.value)}
              className="input w-auto"
            >
              <option value="all">担当すべて</option>
              {marketers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-right font-medium px-3 py-3">導入順</th>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                    クライアント名
                  </th>
                  <th className="text-left font-medium px-4 py-3">URL</th>
                  <th className="text-left font-medium px-4 py-3">解約</th>
                  <th className="text-left font-medium px-4 py-3">マーケ</th>
                  <th className="text-right font-medium px-4 py-3">システム納品</th>
                  <th className="text-center font-medium px-4 py-3">旧SATTOUユーザ</th>
                  <th className="text-left font-medium px-4 py-3">HPB連携</th>
                  <th className="text-left font-medium px-4 py-3">識別子</th>
                  <th className="text-left font-medium px-4 py-3">初期記入シート</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => (
                  <tr
                    key={`${r.identifier || r.clientName}-${r.order}-${idx}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">{r.order}</td>
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      {r.clientId ? (
                        <Link
                          href={`/clients/${r.clientId}`}
                          className="font-medium hover:text-brand-700"
                        >
                          {r.clientName}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.clientName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs max-w-[220px] truncate"
                          title={r.url}
                        >
                          {r.url.replace(/^https?:\/\//, "")}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={cancelledSet.has(rowKey(r))}
                          onChange={() => toggleCancelled(rowKey(r))}
                          className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        {cancelledSet.has(rowKey(r)) && (
                          <span className="pill bg-rose-50 text-rose-700">解約</span>
                        )}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.marketer || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.systemDelivery || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.legacyUser ? (
                        <Check className="w-4 h-4 text-emerald-600 inline" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.hpbLinked && r.hpbLinked !== "—" ? (
                        <span className="pill bg-sky-50 text-sky-700">{r.hpbLinked}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.identifier || "—"}</td>
                    <td className="px-4 py-3">
                      {r.initialSheetUrl ? (
                        <a
                          href={r.initialSheetUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs"
                        >
                          開く <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
