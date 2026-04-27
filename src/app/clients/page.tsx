"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CLIENTS, clientCpa, clientCvr, clientRoas } from "@/lib/mock";
import { num, pct, ratio, yen } from "@/lib/format";
import TopBar from "@/components/TopBar";
import StatusPill from "@/components/StatusPill";
import { ChevronRight, Filter, Search } from "lucide-react";
import type { ClientStatus, Industry } from "@/lib/types";

const INDUSTRIES: (Industry | "all")[] = [
  "all",
  "整体院",
  "整骨院",
  "鍼灸院",
  "美容院",
  "エステ",
  "歯科医院",
  "ジム",
];
const STATUSES: (ClientStatus | "all")[] = ["all", "active", "paused", "trial"];

type SortKey = "name" | "spend" | "bookings" | "cpa" | "roas";

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<Industry | "all">("all");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("cpa");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const list = CLIENTS.filter((c) => {
      if (industry !== "all" && c.industry !== industry) return false;
      if (status !== "all" && c.status !== status) return false;
      if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.id.includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "spend":
          return (a.metrics30d.spend - b.metrics30d.spend) * dir;
        case "bookings":
          return (a.metrics30d.bookings - b.metrics30d.bookings) * dir;
        case "cpa":
          return (clientCpa(a) - clientCpa(b)) * dir;
        case "roas":
          return (clientRoas(a) - clientRoas(b)) * dir;
      }
    });
    return list;
  }, [q, industry, status, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "cpa");
    }
  };

  return (
    <div>
      <TopBar
        title="クライアント"
        subtitle={`登録 ${CLIENTS.length} 社 / 表示 ${filtered.length} 社`}
      />
      <div className="p-6 space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="店舗名 / IDで検索"
                className="input pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value as Industry | "all")}
                className="input w-auto"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i === "all" ? "業種すべて" : i}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus | "all")}
                className="input w-auto"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all"
                      ? "ステータスすべて"
                      : s === "active"
                      ? "稼働中"
                      : s === "paused"
                      ? "停止中"
                      : "トライアル"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3 cursor-pointer" onClick={() => toggleSort("name")}>
                    クライアント
                  </th>
                  <th className="text-left font-medium px-4 py-3">業種 / 地域</th>
                  <th className="text-left font-medium px-4 py-3">ステータス</th>
                  <th className="text-right font-medium px-4 py-3 cursor-pointer" onClick={() => toggleSort("spend")}>
                    広告費 (30d)
                  </th>
                  <th className="text-right font-medium px-4 py-3 cursor-pointer" onClick={() => toggleSort("bookings")}>
                    予約数
                  </th>
                  <th className="text-right font-medium px-4 py-3 cursor-pointer" onClick={() => toggleSort("cpa")}>
                    CPA
                  </th>
                  <th className="text-right font-medium px-4 py-3">CVR</th>
                  <th className="text-right font-medium px-4 py-3 cursor-pointer" onClick={() => toggleSort("roas")}>
                    ROAS
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const cpa = clientCpa(c);
                  const cvr = clientCvr(c);
                  const roas = clientRoas(c);
                  const cpaTone =
                    cpa === 0
                      ? "text-slate-400"
                      : cpa < 4500
                      ? "text-emerald-600"
                      : cpa < 8000
                      ? "text-slate-700"
                      : "text-rose-600";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700">
                          {c.name}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">ID: {c.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{c.industry}</div>
                        <div className="text-xs text-slate-500">{c.prefecture}</div>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{yen(c.metrics30d.spend)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(c.metrics30d.bookings)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${cpaTone}`}>
                        {cpa ? yen(cpa) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(cvr, 1)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{ratio(roas)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`} className="text-slate-400 hover:text-brand-700">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
