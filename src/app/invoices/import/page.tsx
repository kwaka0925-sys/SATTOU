"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  Coins,
  FileSpreadsheet,
  FileUp,
  Sparkles,
  Wallet,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { yen } from "@/lib/format";
import { SAMPLE_SHEET, STATUS_TO_INTERNAL, type ImportStatus } from "@/lib/importSample";

const STATUS_BADGE: Record<ImportStatus, string> = {
  振り込み済: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  請求書発行済: "bg-sky-50 text-sky-700 border border-sky-200",
  未払い: "bg-amber-50 text-amber-700 border border-amber-200",
  期限超過: "bg-rose-50 text-rose-700 border border-rose-200",
  下書き: "bg-slate-100 text-slate-600 border border-slate-200",
};

const INTERNAL_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: "支払済", cls: "bg-emerald-50 text-emerald-700" },
  unpaid: { label: "未払い", cls: "bg-amber-50 text-amber-700" },
  overdue: { label: "期限超過", cls: "bg-rose-50 text-rose-700" },
  draft: { label: "下書き", cls: "bg-slate-100 text-slate-600" },
};

export default function ImportDemoPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const totals = useMemo(() => {
    const paid = SAMPLE_SHEET.filter((r) => STATUS_TO_INTERNAL[r.status] === "paid");
    const unpaid = SAMPLE_SHEET.filter((r) => STATUS_TO_INTERNAL[r.status] === "unpaid");
    const overdue = SAMPLE_SHEET.filter((r) => STATUS_TO_INTERNAL[r.status] === "overdue");
    const draft = SAMPLE_SHEET.filter((r) => STATUS_TO_INTERNAL[r.status] === "draft");
    const sum = (rs: typeof SAMPLE_SHEET) => rs.reduce((s, r) => s + r.amount, 0);
    return {
      total: sum(SAMPLE_SHEET),
      paid: { count: paid.length, amount: sum(paid) },
      unpaid: { count: unpaid.length, amount: sum(unpaid) },
      overdue: { count: overdue.length, amount: sum(overdue) },
      draft: { count: draft.length, amount: sum(draft) },
    };
  }, []);

  return (
    <div>
      <TopBar
        title="スプレッドシート取り込みデモ"
        subtitle="既存の請求書スプレッドシート（振り込み・請求書・未払い等）がどのようにツールに反映されるかをサンプルで表示"
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/invoices" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand-700">
            <ArrowLeft className="w-4 h-4" /> 請求書一覧へ
          </Link>
          <ol className="flex items-center gap-2 text-xs text-slate-500">
            <li className={`pill ${step === "upload" ? "bg-brand-50 text-brand-700" : "bg-slate-100"}`}>1. アップロード</li>
            <span className="text-slate-300">›</span>
            <li className={`pill ${step === "preview" ? "bg-brand-50 text-brand-700" : "bg-slate-100"}`}>2. プレビュー</li>
            <span className="text-slate-300">›</span>
            <li className={`pill ${step === "done" ? "bg-brand-50 text-brand-700" : "bg-slate-100"}`}>3. 反映完了</li>
          </ol>
        </div>

        {/* STEP 1: BEFORE - the spreadsheet */}
        <section className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Before — お客様のスプレッドシート
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                こんな形のシートを想定しています（列名や順序は取り込み時にマッピング可）
              </p>
            </div>
            <button
              onClick={() => setStep("preview")}
              className="btn-primary"
            >
              <FileUp className="w-4 h-4" /> このシートを取り込む
            </button>
          </div>

          <div className="rounded-lg border border-slate-300 overflow-hidden">
            <div className="bg-emerald-700 text-white text-xs px-3 py-1.5 flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="font-medium">2026年4月_請求管理.xlsx</span>
              <span className="opacity-70 ml-2">Sheet1</span>
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-xs border-collapse" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="border border-slate-200 w-10 px-2 py-1.5"></th>
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((c) => (
                      <th key={c} className="border border-slate-200 px-2 py-1.5 text-center font-normal">{c}</th>
                    ))}
                  </tr>
                  <tr className="bg-emerald-50 text-slate-700">
                    <td className="border border-slate-200 text-center text-slate-500 py-1.5">1</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">No</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">請求書ID</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">取引先（クライアント）</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">業種</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">発行日</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">支払期日</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold text-right">金額</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">ステータス</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">入金日 / 備考</td>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_SHEET.map((r, i) => (
                    <tr key={r.invoiceId} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="border border-slate-200 text-center text-slate-500">{i + 2}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.no}</td>
                      <td className="border border-slate-200 px-2 py-1 font-mono">{r.invoiceId}</td>
                      <td className="border border-slate-200 px-2 py-1">{r.clientName}</td>
                      <td className="border border-slate-200 px-2 py-1 text-slate-600">{r.industry}</td>
                      <td className="border border-slate-200 px-2 py-1 text-slate-600">{r.issueDate}</td>
                      <td className="border border-slate-200 px-2 py-1 text-slate-600">{r.dueDate}</td>
                      <td className="border border-slate-200 px-2 py-1 text-right tabular-nums">¥{r.amount.toLocaleString()}</td>
                      <td className="border border-slate-200 px-2 py-1">
                        <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-2 py-1 text-slate-500">
                        {r.paidDate ? `入金 ${r.paidDate}` : r.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {step !== "upload" && (
          <div className="flex justify-center text-slate-400">
            <ArrowDown className="w-6 h-6" />
          </div>
        )}

        {/* STEP 2: MAPPING */}
        {step !== "upload" && (
          <section className="card p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand-600" /> 列マッピング（自動推定）
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              シートの列名を自動で検出し、ツール側のフィールドに割り当てます。必要に応じて変更可能です。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                { from: "請求書ID", to: "Invoice ID", required: true },
                { from: "取引先（クライアント）", to: "Client（自動マッチング）", required: true },
                { from: "業種", to: "Industry" },
                { from: "発行日", to: "Issue Date", required: true },
                { from: "支払期日", to: "Due Date", required: true },
                { from: "金額", to: "Amount (JPY)", required: true },
                { from: "ステータス", to: "Status", required: true },
                { from: "入金日 / 備考", to: "Paid Date / Note" },
              ].map((m) => (
                <div key={m.from} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                  <span className="font-mono text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
                    {m.from}
                  </span>
                  <span className="text-slate-400 text-xs">→</span>
                  <span className="font-medium">{m.to}</span>
                  {m.required && <span className="ml-auto text-[10px] text-rose-600">必須</span>}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-2">ステータス変換ルール</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(["振り込み済", "請求書発行済", "未払い", "期限超過", "下書き"] as ImportStatus[]).map((s) => {
                  const internal = STATUS_TO_INTERNAL[s];
                  const b = INTERNAL_BADGE[internal];
                  return (
                    <div key={s} className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
                      <span className={`inline-block rounded px-2 py-0.5 ${STATUS_BADGE[s]}`}>{s}</span>
                      <span className="text-slate-400">→</span>
                      <span className={`pill ${b.cls}`}>{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {step === "preview" && (
              <div className="mt-5 flex justify-end">
                <button onClick={() => setStep("done")} className="btn-primary">
                  この内容で反映する
                </button>
              </div>
            )}
          </section>
        )}

        {step === "done" && (
          <>
            <div className="flex justify-center text-slate-400">
              <ArrowDown className="w-6 h-6" />
            </div>

            {/* STEP 3: AFTER */}
            <section className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> After — ツールに反映された状態
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {SAMPLE_SHEET.length} 件の請求書を取り込みました。サマリーカード・一覧・各クライアント詳細に反映されます。
                  </p>
                </div>
                <button onClick={() => setStep("upload")} className="btn-ghost text-xs">
                  最初からやり直す
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> 請求総額
                  </div>
                  <div className="text-xl font-semibold mt-1">{yen(totals.total)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{SAMPLE_SHEET.length}件</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> 振り込み済（入金確認）
                  </div>
                  <div className="text-xl font-semibold mt-1 text-emerald-700">{yen(totals.paid.amount)}</div>
                  <div className="text-xs text-emerald-700/80 mt-0.5">{totals.paid.count}件</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                  <div className="text-xs text-amber-700">請求書発行済 + 未払い</div>
                  <div className="text-xl font-semibold mt-1 text-amber-700">{yen(totals.unpaid.amount)}</div>
                  <div className="text-xs text-amber-700/80 mt-0.5">{totals.unpaid.count}件</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
                  <div className="text-xs text-rose-700">期限超過</div>
                  <div className="text-xl font-semibold mt-1 text-rose-700">{yen(totals.overdue.amount)}</div>
                  <div className="text-xs text-rose-700/80 mt-0.5">{totals.overdue.count}件</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5">請求書</th>
                      <th className="text-left font-medium px-4 py-2.5">クライアント</th>
                      <th className="text-left font-medium px-4 py-2.5">発行日 / 期日</th>
                      <th className="text-right font-medium px-4 py-2.5">金額</th>
                      <th className="text-left font-medium px-4 py-2.5">元のステータス</th>
                      <th className="text-left font-medium px-4 py-2.5">ツール上の表示</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SAMPLE_SHEET.map((r) => {
                      const internal = STATUS_TO_INTERNAL[r.status];
                      const b = INTERNAL_BADGE[internal];
                      return (
                        <tr key={r.invoiceId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs">{r.invoiceId}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{r.clientName}</div>
                            <div className="text-xs text-slate-500">{r.industry}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">
                            {r.issueDate}
                            <div className="text-slate-500">→ {r.dueDate}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">{yen(r.amount)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_BADGE[r.status]}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`pill ${b.cls}`}>{b.label}</span>
                            {r.paidDate && (
                              <div className="text-[11px] text-slate-500 mt-0.5">入金 {r.paidDate}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-lg bg-brand-50 border border-brand-200 text-brand-900 p-4 text-sm">
                <div className="font-medium mb-1">この後、自動で連動する画面</div>
                <ul className="list-disc pl-5 space-y-0.5 text-brand-900/80 text-xs">
                  <li>ダッシュボードの「請求総額 / 入金済み / 未入金」カードに即時反映</li>
                  <li>各クライアント詳細ページの「請求書」セクションに紐付け（取引先名で自動マッチング）</li>
                  <li>請求書一覧 (<code>/invoices</code>) でステータス別フィルタが利用可能に</li>
                  <li>期限超過分は自動で<span className="text-rose-600 font-medium">アラート</span>表示</li>
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
