import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  Coins,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  Receipt,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import StatCard from "@/components/StatCard";
import StatusPill from "@/components/StatusPill";
import { CLIENTS, getClient, clientCpa, clientCvr, clientRoas } from "@/lib/mock";
import { num, pct, ratio, shortDate, yen } from "@/lib/format";
import { SpendBookingChart, CpaTrendChart } from "@/components/charts/SpendBookingChart";

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ id: c.id }));
}

export default function ClientDetail({ params }: { params: { id: string } }) {
  const client = getClient(params.id);
  if (!client) notFound();

  const cpa = clientCpa(client);
  const cvr = clientCvr(client);
  const roas = clientRoas(client);

  const cpaDaily = client.daily.map((d) => ({
    date: d.date,
    cpa: d.bookings ? Math.round(d.spend / d.bookings) : 0,
  }));

  const latestInvoice = client.invoices[client.invoices.length - 1];

  return (
    <div>
      <TopBar
        title={client.name}
        subtitle={`${client.industry} · ${client.prefecture} · 担当 ${client.representative}`}
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/clients" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-brand-700">
            <ArrowLeft className="w-4 h-4" /> クライアント一覧へ
          </Link>
          <div className="flex items-center gap-2">
            <StatusPill status={client.status} />
            <span className="pill bg-slate-100 text-slate-600">契約開始 {client.contractStart}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-semibold mb-4">ハイライト（直近30日）</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="広告費" value={yen(client.metrics30d.spend)} icon={<Coins className="w-4 h-4" />} delta={5.2} />
              <StatCard label="予約数" value={num(client.metrics30d.bookings)} icon={<CalendarCheck2 className="w-4 h-4" />} delta={11.4} />
              <StatCard label="CPA" value={cpa ? yen(cpa) : "—"} icon={<TrendingUp className="w-4 h-4" />} delta={-4.1} hint="低いほど良" />
              <StatCard label="ROAS" value={ratio(roas)} icon={<TrendingUp className="w-4 h-4" />} delta={3.2} />
            </div>
            <div className="mt-6">
              <SpendBookingChart data={client.daily} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-4">クライアント情報</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-slate-500 text-xs">住所</dt>
                  <dd>{client.prefecture}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-slate-500 text-xs">電話</dt>
                  <dd>03-{1000 + parseInt(client.id, 10)}-{8000 + parseInt(client.id, 10) * 3}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-slate-500 text-xs">担当者メール</dt>
                  <dd className="break-all">{client.id}@{client.industry === "ジム" ? "fit" : "salon"}.example.jp</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-slate-500 text-xs">月額契約料</dt>
                  <dd>{yen(client.monthlyFee)} / 月</dd>
                </div>
              </div>
            </dl>
            <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">Meta Ads</div>
                <div className="font-mono mt-0.5 truncate">{client.metaAccountId}</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">SATTOU</div>
                <div className="font-mono mt-0.5 truncate">{client.sattouAccountId}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">CPA推移</h2>
              <div className="text-xs text-slate-500">直近30日</div>
            </div>
            <CpaTrendChart data={cpaDaily} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">インプレッション</div>
                <div className="font-semibold">{num(client.metrics30d.impressions)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">クリック</div>
                <div className="font-semibold">{num(client.metrics30d.clicks)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">CVR</div>
                <div className="font-semibold">{pct(cvr, 1)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">来店確定</div>
                <div className="font-semibold">{num(client.metrics30d.completedVisits)}件</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4" /> 請求書
              </h2>
              <Link href={`/invoices?client=${client.id}`} className="text-xs text-brand-700">
                すべて表示
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {client.invoices.map((inv) => (
                <li key={inv.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-brand-700">
                      {inv.id}
                    </Link>
                    <div className="text-xs text-slate-500">発行 {inv.issueDate} / 期日 {inv.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{yen(inv.amount)}</div>
                    <div className="text-xs">
                      <span
                        className={`pill ${
                          inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : inv.status === "unpaid"
                            ? "bg-amber-50 text-amber-700"
                            : inv.status === "overdue"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.status === "paid"
                          ? "支払済"
                          : inv.status === "unpaid"
                          ? "未払い"
                          : inv.status === "overdue"
                          ? "期限超過"
                          : "下書き"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {latestInvoice && (
              <Link href={`/invoices/${latestInvoice.id}`} className="btn-primary w-full justify-center mt-4">
                最新請求書を開く
              </Link>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">日別データ</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-3 py-2">日付</th>
                  <th className="text-right font-medium px-3 py-2">広告費</th>
                  <th className="text-right font-medium px-3 py-2">インプレッション</th>
                  <th className="text-right font-medium px-3 py-2">クリック</th>
                  <th className="text-right font-medium px-3 py-2">予約</th>
                  <th className="text-right font-medium px-3 py-2">CPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...client.daily].reverse().slice(0, 14).map((d) => {
                  const cpaDaily = d.bookings ? Math.round(d.spend / d.bookings) : 0;
                  return (
                    <tr key={d.date}>
                      <td className="px-3 py-2">{shortDate(d.date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{yen(d.spend)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.impressions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(d.bookings)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cpaDaily ? yen(cpaDaily) : "—"}</td>
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
