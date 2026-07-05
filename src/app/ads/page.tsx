import Link from "next/link";
import {
  Coins,
  CalendarCheck2,
  TrendingUp,
  Users,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import StatCard from "@/components/StatCard";
import { CLIENTS, totalsAll, clientCpa, clientRoas } from "@/lib/mock";
import { num, pct, ratio, yen } from "@/lib/format";
import {
  SpendBookingChart,
  CpaTrendChart,
} from "@/components/charts/SpendBookingChart";

export default function AdsPage() {
  const totals = totalsAll();
  const activeClients = CLIENTS.filter((c) => c.status === "active").length;

  const aggDaily = CLIENTS[0].daily.map((_, idx) => {
    const day = CLIENTS.reduce(
      (acc, c) => {
        const d = c.daily[idx];
        return {
          date: d.date,
          spend: acc.spend + d.spend,
          bookings: acc.bookings + d.bookings,
        };
      },
      { date: "", spend: 0, bookings: 0 },
    );
    return day;
  });

  const cpaDaily = aggDaily.map((d) => ({
    date: d.date,
    cpa: d.bookings ? Math.round(d.spend / d.bookings) : 0,
  }));

  const ranked = [...CLIENTS]
    .filter((c) => c.metrics30d.bookings > 0)
    .sort((a, b) => clientCpa(a) - clientCpa(b));
  const topPerformers = ranked.slice(0, 5);
  const needAttention = [...CLIENTS]
    .filter((c) => c.status === "active")
    .sort((a, b) => clientCpa(b) - clientCpa(a))
    .slice(0, 5);

  return (
    <div>
      <TopBar
        title="広告分析"
        subtitle="Meta広告 × SATTOU予約 — 全クライアント合算パフォーマンス（直近30日）"
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="総広告費"
            value={yen(totals.spend)}
            delta={4.8}
            icon={<Coins className="w-4 h-4" />}
            hint="前月比"
          />
          <StatCard
            label="総予約数"
            value={num(totals.bookings)}
            delta={9.2}
            icon={<CalendarCheck2 className="w-4 h-4" />}
            hint="前月比"
          />
          <StatCard
            label="平均CPA"
            value={yen(totals.cpa)}
            delta={-3.1}
            icon={<TrendingUp className="w-4 h-4" />}
            hint="前月比（低いほど良)"
          />
          <StatCard
            label="ROAS"
            value={ratio(totals.roas)}
            delta={6.4}
            icon={<TrendingUp className="w-4 h-4" />}
            hint="売上 / 広告費"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">広告費 × 予約数 推移（30日）</h2>
                <p className="text-xs text-slate-500 mt-0.5">全クライアント合算</p>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> 広告費</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 予約数</span>
              </div>
            </div>
            <SpendBookingChart data={aggDaily} />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">CPA推移</h2>
                <p className="text-xs text-slate-500 mt-0.5">全体平均</p>
              </div>
            </div>
            <CpaTrendChart data={cpaDaily} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">CTR</div>
                <div className="font-semibold">{pct(totals.ctr)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">CVR (Click→予約)</div>
                <div className="font-semibold">{pct(totals.cvr)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> CPAが優秀なクライアントTOP5
              </h2>
              <Link href="/rankings" className="text-xs text-brand-700 inline-flex items-center gap-1">
                全件 <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {topPerformers.map((c, i) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700 truncate block">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">{c.industry} · {c.prefecture}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{yen(clientCpa(c))}</div>
                    <div className="text-xs text-slate-500">予約 {c.metrics30d.bookings}件</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> 改善要のクライアント
              </h2>
              <span className="text-xs text-slate-500">CPAが高い順</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {needAttention.map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700 truncate block">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      広告費 {yen(c.metrics30d.spend)} · 予約 {c.metrics30d.bookings}件
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-rose-600">{yen(clientCpa(c))}</div>
                    <div className="text-xs text-slate-500">ROAS {ratio(clientRoas(c))}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> クライアントサマリー
            </h2>
            <div className="text-xs text-slate-500">
              全 {CLIENTS.length} 社 / 稼働中 {activeClients} 社
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">合計売上(推定)</div>
              <div className="font-semibold mt-1">{yen(totals.revenue)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">来店確定数</div>
              <div className="font-semibold mt-1">{num(totals.completedVisits)}件</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">広告クリック</div>
              <div className="font-semibold mt-1">{num(totals.clicks)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">インプレッション</div>
              <div className="font-semibold mt-1">{num(totals.impressions)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
