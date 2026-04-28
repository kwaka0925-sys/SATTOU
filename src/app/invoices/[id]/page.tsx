import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer, Send } from "lucide-react";
import TopBar from "@/components/TopBar";
import { findInvoiceById } from "@/lib/sheets";
import { getClient } from "@/lib/mock";
import { yen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const inv = await findInvoiceById(params.id);
  if (!inv) notFound();

  const client = inv.clientId ? getClient(inv.clientId) : undefined;

  const total = inv.amount;
  const subtotal = Math.round(total / 1.1);
  const tax = total - subtotal;

  const statusLabel =
    inv.status === "paid"
      ? "支払済"
      : inv.status === "unpaid"
      ? "未払い"
      : inv.status === "overdue"
      ? "期限超過"
      : "下書き";

  return (
    <div>
      <TopBar title={`請求書 ${inv.id}`} subtitle={`宛先: ${inv.clientName}`} />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/invoices" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand-700">
            <ArrowLeft className="w-4 h-4" /> 請求書一覧へ
          </Link>
          <div className="flex items-center gap-2">
            <button className="btn-ghost"><Printer className="w-4 h-4" /> 印刷</button>
            <button className="btn-ghost"><Download className="w-4 h-4" /> PDFダウンロード</button>
            <button className="btn-primary"><Send className="w-4 h-4" /> メール送信</button>
          </div>
        </div>

        <div className="card p-10 max-w-4xl mx-auto print:shadow-none print:border-none">
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <div className="text-3xl font-bold tracking-tight">請求書</div>
              <div className="text-sm text-slate-500 mt-1">INVOICE</div>
              <div className="mt-4 text-sm">
                <div className="font-medium text-base">{inv.clientName} 御中</div>
                {client && (
                  <>
                    <div className="text-slate-500">{client.prefecture}</div>
                    <div className="text-slate-500">担当: {client.representative} 様</div>
                  </>
                )}
                {inv.payeeName && (
                  <div className="text-slate-500 mt-1">振込名義: {inv.payeeName}</div>
                )}
                {inv.subscriberId && (
                  <div className="text-slate-500">加入者識別番号: {inv.subscriberId}</div>
                )}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold text-base">SATTOU株式会社</div>
              <div className="text-slate-500">〒150-0001 東京都渋谷区</div>
              <div className="text-slate-500">登録番号: T1234567890123</div>
              <div className="text-slate-500 mt-2">請求書番号: <span className="font-mono">{inv.id}</span></div>
              <div className="text-slate-500">発行日: {inv.issueDate}</div>
              <div className="text-slate-500">支払期日: {inv.dueDate}</div>
              {inv.paymentMethod && (
                <div className="text-slate-500">支払方法: {inv.paymentMethod}</div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">ご請求金額（税込）</div>
              <div className="text-3xl font-bold mt-1">{yen(inv.amount)}</div>
            </div>
            <span
              className={`pill text-sm px-3 py-1 ${
                inv.status === "paid"
                  ? "bg-emerald-50 text-emerald-700"
                  : inv.status === "unpaid"
                  ? "bg-amber-50 text-amber-700"
                  : inv.status === "overdue"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-8">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-200">
                <tr>
                  <th className="text-left font-medium px-3 py-2">項目</th>
                  <th className="text-right font-medium px-3 py-2 w-20">数量</th>
                  <th className="text-right font-medium px-3 py-2 w-32">単価</th>
                  <th className="text-right font-medium px-3 py-2 w-32">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3">{it.label}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{yen(it.unitPrice)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{yen(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">小計（税抜）</span>
                <span className="tabular-nums">{yen(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>消費税 (10%)</span>
                <span className="tabular-nums">{yen(tax)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-base">
                <span>合計（税込）</span>
                <span className="tabular-nums">{yen(total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500">
            <div className="font-medium text-slate-700 mb-1">お振込先</div>
            <div>みずほ銀行 渋谷支店 (普) 1234567 サットウ(カ</div>
            {inv.note && (
              <>
                <div className="mt-3 font-medium text-slate-700 mb-1">備考</div>
                <div>{inv.note}</div>
              </>
            )}
            <div className="mt-3 font-medium text-slate-700 mb-1">振込手数料</div>
            <div>お振込手数料は貴社にてご負担いただきますようお願いいたします。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
