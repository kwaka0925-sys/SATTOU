import Link from "next/link";
import {
  Coins,
  Users,
  Store,
  ArrowUpRight,
  Trophy,
  PieChart,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import StatCard from "@/components/StatCard";
import { CLIENTS } from "@/lib/mock";
import { num, yen } from "@/lib/format";
import { fetchDashboardTotals, currentMonth } from "@/lib/sheets";
import type { Industry } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentMonth();
  const sheetTotals = await fetchDashboardTotals(month);

  const mockRevenue = CLIENTS.reduce((s, c) => s + c.monthlyFee, 0);
  const mockCustomerCount = CLIENTS.length;
  const mockBrandCount = new Set(CLIENTS.map((c) => c.brand)).size;

  const useSheet = sheetTotals.configured && sheetTotals.customerCount > 0;
  const revenue = useSheet ? sheetTotals.revenue : mockRevenue;
  const customerCount = useSheet ? sheetTotals.customerCount : mockCustomerCount;
  const brandCount = useSheet ? sheetTotals.brandCount : mockBrandCount;

  const dataHint = useSheet
    ? `${monthLabel(month)}分 · 請求書シート集計`
    : `モックデータ (${CLIENTS.length}社)`;

  const brandTotals = Object.entries(
    CLIENTS.reduce<Record<string, { revenue: number; count: number }>>((acc, c) => {
      acc[c.brand] ??= { revenue: 0, count: 0 };
      acc[c.brand].revenue += c.monthlyFee;
      acc[c.brand].count += 1;
      return acc;
    }, {}),
  )
    .map(([brand, v]) => ({ brand, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const brandTop = brandTotals.slice(0, 10);
  const brandMax = brandTop[0]?.revenue ?? 1;

  const revenueTop5 = [...CLIENTS]
    .sort((a, b) => b.monthlyFee - a.monthlyFee)
    .slice(0, 5);

  const industryTotals = Object.entries(
    CLIENTS.reduce<Record<Industry, number>>((acc, c) => {
      acc[c.industry] = (acc[c.industry] ?? 0) + c.monthlyFee;
      return acc;
    }, {} as Record<Industry, number>),
  )
    .map(([industry, revenue]) => ({ industry: industry as Industry, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const industryTotal = industryTotals.reduce((s, x) => s + x.revenue, 0);

  return (
    <div>
      <TopBar
        title="ダッシュボード"
        subtitle={`SATTOU 経営指標サマリー — ${monthLabel(month)}分`}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="総売上"
            value={yen(revenue)}
            icon={<Coins className="w-4 h-4" />}
            hint={dataHint}
          />
          <StatCard
            label="総顧客数"
            value={num(customerCount)}
            icon={<Users className="w-4 h-4" />}
            hint={useSheet ? "請求先サロン" : `全 ${CLIENTS.length} 社`}
          />
          <StatCard
            label="総ブランド数"
            value={num(brandCount)}
            icon={<Store className="w-4 h-4" />}
            hint={
              useSheet
                ? sheetTotals.storeCount
                  ? `店舗数 ${num(sheetTotals.storeCount)}`
                  : "請求先合計"
                : `${CLIENTS.length} 店舗を運営`
            }
          />
        </div>

        {!sheetTotals.configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            KPI はモックデータで表示中。<code>SHEETS_GAS_URL</code> と <code>SHEETS_GAS_TOKEN</code> を Vercel の環境変数に登録すると、請求書シートの月次総計に切り替わります。詳細は README の GAS連携セクションを参照。
          </div>
        )}
        {sheetTotals.configured && !useSheet && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)} 分のデータが請求書シートに見つかりませんでした。<code>?month=YYYY-MM</code> で別の月を指定できます。
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card p-5 xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Store className="w-4 h-4 text-brand-600" /> ブランド別月額売上 (デモ)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">上位 {brandTop.length} ブランド / 全 {brandTotals.length} ブランド</p>
              </div>
            </div>
            <ul className="space-y-3">
              {brandTop.map((b, i) => {
                const widthPct = Math.max(4, Math.round((b.revenue / brandMax) * 100));
                return (
                  <li key={b.brand} className="flex items-center gap-3">
                    <div className="w-6 text-xs text-slate-500 text-right tabular-nums">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate">{b.brand}</span>
                        <span className="text-slate-600 tabular-nums pl-3">{yen(b.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{b.count} 店舗</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> 月額売上 TOP5 (デモ)
              </h2>
              <Link href="/clients" className="text-xs text-brand-700 inline-flex items-center gap-1">
                全件 <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {revenueTop5.map((c, i) => (
                <li key={c.id} className="py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700 truncate block">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500 truncate">{c.brand}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{yen(c.monthlyFee)}</div>
                    <div className="text-xs text-slate-500">{c.industry}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-600" /> 業種別月額売上構成 (デモ)
            </h2>
            <span className="text-xs text-slate-500">合計 {yen(industryTotal)}</span>
          </div>
          <ul className="space-y-3">
            {industryTotals.map((it) => {
              const share = industryTotal > 0 ? it.revenue / industryTotal : 0;
              const widthPct = Math.max(3, Math.round(share * 100));
              return (
                <li key={it.industry} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-slate-600 shrink-0">{it.industry}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="w-32 text-right text-sm tabular-nums">
                    <span className="font-semibold">{yen(it.revenue)}</span>
                    <span className="text-slate-500 ml-2">{(share * 100).toFixed(1)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
