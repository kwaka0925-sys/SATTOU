"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CLIENTS } from "@/lib/mock";
import { yen } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import type { Invoice } from "@/lib/types";

type Row = Invoice & { clientName: string };

const STATUS_LABEL: Record<Invoice["status"], { label: string; cls: string }> = {
  paid: { label: "支払済", cls: "bg-emerald-50 text-emerald-700" },
  unpaid: { label: "未払い", cls: "bg-amber-50 text-amber-700" },
  overdue: { label: "期限超過", cls: "bg-rose-50 text-rose-700" },
  draft: { label: "下書き", cls: "bg-slate-100 text-slate-600" },
};

export default function InvoicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Invoice["status"] | "all">("all");

  const rows: Row[] = useMemo(() => {
    return CLIENTS.flatMap((c) =>
      c.invoices.map((inv) => ({ ...inv, clientName: c.name })),
    ).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  }, []);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !r.clientName.toLowerCase().includes(q.toLowerCase()) && !r.id.includes(q)) return false;
    return true;
  });

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + r.amount,
      unpaid: acc.unpaid + (r.status === "unpaid" || r.status === "overdue" ? r.amount : 0),
      paid: acc.paid + (r.status === "paid" ? r.amount : 0),
    }),
    { total: 0, unpaid: 0, paid: 0 },
  );

  return (
    <div>
      <TopBar
        title="請求書"
        subtitle={`発行済み ${rows.length} 件 / 表示 ${filtered.length} 件`}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">請求総額</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.total)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">入金済み</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600">{yen(totals.paid)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">未入金</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">{yen(totals.unpaid)}</div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="クライアント名 / 請求書IDで検索"
              className="input pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Invoice["status"] | "all")}
            className="input w-auto"
          >
            <option value="all">ステータスすべて</option>
            <option value="paid">支払済</option>
            <option value="unpaid">未払い</option>
            <option value="overdue">期限超過</option>
            <option value="draft">下書き</option>
          </select>
          <Link href="/invoices/import" className="btn-ghost ml-auto">
            <FileSpreadsheet className="w-4 h-4" />
            スプレッドシート取り込み
          </Link>
          <button className="btn-primary">
            <FileText className="w-4 h-4" />
            一括請求書を作成
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">請求書ID</th>
                  <th className="text-left font-medium px-4 py-3">クライアント</th>
                  <th className="text-left font-medium px-4 py-3">発行日</th>
                  <th className="text-left font-medium px-4 py-3">支払期日</th>
                  <th className="text-right font-medium px-4 py-3">金額</th>
                  <th className="text-left font-medium px-4 py-3">ステータス</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const st = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-3">
                        <Link href={`/clients/${r.clientId}`} className="hover:text-brand-700">
                          {r.clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.issueDate}</td>
                      <td className="px-4 py-3">{r.dueDate}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{yen(r.amount)}</td>
                      <td className="px-4 py-3"><span className={`pill ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${r.id}`} className="text-brand-700 text-xs">
                          開く
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
