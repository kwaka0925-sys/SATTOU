"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { ExternalLink, Filter, Search } from "lucide-react";
import type { StoreRow } from "./page";

type CancelFilter = "all" | "継続" | "解約";
type TemplateFilter = "all" | "済" | "未";
type CreativeFilter = "all" | string;

type Props = {
  rows: StoreRow[];
};

export default function StoresView({ rows }: Props) {
  const [q, setQ] = useState("");
  const [cancel, setCancel] = useState<CancelFilter>("all");
  const [template, setTemplate] = useState<TemplateFilter>("all");
  const [creative, setCreative] = useState<CreativeFilter>("all");
  const [marketer, setMarketer] = useState<string>("all");

  const marketers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.marketer).filter(Boolean))).sort(),
    [rows],
  );
  const creatives = useMemo(
    () => Array.from(new Set(rows.map((r) => r.creative).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cancel !== "all" && r.cancelled !== cancel) return false;
      if (template !== "all" && r.templateInstalled !== template) return false;
      if (creative !== "all" && r.creative !== creative) return false;
      if (marketer !== "all" && r.marketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [r.clientName, r.identifier, r.brand]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, q, cancel, template, creative, marketer]);

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + 1,
      cancelled: acc.cancelled + (r.cancelled === "解約" ? 1 : 0),
      template: acc.template + (r.templateInstalled === "済" ? 1 : 0),
      hpb: acc.hpb + (r.hpbLinked === "連携" ? 1 : 0),
    }),
    { total: 0, cancelled: 0, template: 0, hpb: 0 },
  );

  return (
    <div>
      <TopBar
        title="sattou導入店舗"
        subtitle={`全 ${rows.length} 店舗 / 表示 ${filtered.length} 店舗 · 導入・解約・連携状況の一覧`}
      />
      <div className="p-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
          この画面は sattou 導入店舗管理シートを表示する予定です。対象タブ名と列マッピングが確定次第、GAS 連携で実データに切り替えられます。
        </div>

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
            <div className="text-sm text-slate-500">テンプレート設置済</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600">{num(totals.template)}</div>
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
              placeholder="サロン名 / 識別子 / ブランドで検索"
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
            value={template}
            onChange={(e) => setTemplate(e.target.value as TemplateFilter)}
            className="input w-auto"
          >
            <option value="all">テンプレすべて</option>
            <option value="済">済</option>
            <option value="未">未</option>
          </select>
          <select
            value={creative}
            onChange={(e) => setCreative(e.target.value)}
            className="input w-auto"
          >
            <option value="all">クリエイティブすべて</option>
            {creatives.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
                  <th className="text-left font-medium px-4 py-3">テンプレート設置</th>
                  <th className="text-left font-medium px-4 py-3">解約</th>
                  <th className="text-left font-medium px-4 py-3">クリエイティブ</th>
                  <th className="text-left font-medium px-4 py-3">マーケ</th>
                  <th className="text-left font-medium px-4 py-3">システム納品</th>
                  <th className="text-left font-medium px-4 py-3">旧SATTOUユーザ</th>
                  <th className="text-left font-medium px-4 py-3">以降 (旧)</th>
                  <th className="text-left font-medium px-4 py-3">HPB連携</th>
                  <th className="text-left font-medium px-4 py-3">識別子</th>
                  <th className="text-left font-medium px-4 py-3">初期記入シート</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.clientId} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">{r.order}</td>
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      <Link
                        href={`/clients/${r.clientId}`}
                        className="font-medium hover:text-brand-700"
                      >
                        {r.clientName}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">{r.brand}</div>
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`pill ${
                          r.templateInstalled === "済"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.templateInstalled}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`pill ${
                          r.cancelled === "解約"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.cancelled}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{r.creative}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.marketer}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.systemDelivery}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.legacyUser}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.since || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`pill ${
                          r.hpbLinked === "連携"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {r.hpbLinked}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.identifier}</td>
                    <td className="px-4 py-3">
                      <a
                        href={r.initialSheetUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs"
                      >
                        開く <ExternalLink className="w-3 h-3" />
                      </a>
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
