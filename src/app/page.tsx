import {
  Coins,
  Store,
  Building2,
  Megaphone,
  Landmark,
  FileText,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import StatCard from "@/components/StatCard";
import MonthPicker from "@/components/MonthPicker";
import ActivityTiles from "@/components/ActivityTiles";
import { num, yen } from "@/lib/format";
import { fetchDashboardTotals, currentBillingMonth } from "@/lib/sheets";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-");
  const mNum = parseInt(m, 10);
  const opMonth = mNum === 1 ? 12 : mNum - 1;
  return `${y}年${mNum}月分（${opMonth}月稼働分）`;
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {title}
      </div>
      {subtitle && (
        <div className="text-[11px] text-slate-400">{subtitle}</div>
      )}
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentBillingMonth();
  const sheetTotals = await fetchDashboardTotals(month);
  const hasData = sheetTotals.configured && sheetTotals.customerCount > 0;

  const revenueIncTax = sheetTotals.revenue;
  const revenueExTax = Math.round(revenueIncTax / 1.1);
  const opFeeIncTax = sheetTotals.operationFeeIncTax;
  const opFeeExTax =
    sheetTotals.operationFeeExTax > 0
      ? sheetTotals.operationFeeExTax
      : Math.round(opFeeIncTax / 1.1);
  const systemRevenueIncTax = Math.max(revenueIncTax - opFeeIncTax, 0);
  const systemRevenueExTax = Math.max(revenueExTax - opFeeExTax, 0);
  const dataHint = hasData
    ? `${monthLabel(month)}分 · 請求書シート集計`
    : "実データ接続待ち";

  const totalPay = sheetTotals.transferCount + sheetTotals.invoiceCount;
  const transferRate =
    totalPay > 0 ? Math.round((sheetTotals.transferCount / totalPay) * 100) : 0;

  return (
    <div>
      <TopBar
        title="SATTOU管理"
        subtitle={`SATTOU 経営指標サマリー — ${monthTitle(month)}`}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>

        {/* Section: 売上 (6 tiles, compact grid so tiles don't stretch horizontally) */}
        <section className="space-y-3">
          <SectionHeading title="売上" subtitle={monthLabel(month)} />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard
              size="sm"
              accent="primary"
              label="総売上（税抜き）"
              value={yen(revenueExTax)}
              icon={<Coins className="w-4 h-4" />}
              hint={hasData ? "税率10%仮定" : dataHint}
            />
            <StatCard
              size="sm"
              accent="primary"
              label="総売上（税込み）"
              value={yen(revenueIncTax)}
              icon={<Coins className="w-4 h-4" />}
              hint={hasData ? "請求書シート集計" : dataHint}
            />
            <StatCard
              size="sm"
              accent="brand"
              label="システム売上（税抜き）"
              value={yen(systemRevenueExTax)}
              icon={<Coins className="w-4 h-4" />}
              hint={hasData ? "総売上 − 広告運用代行費" : dataHint}
            />
            <StatCard
              size="sm"
              accent="brand"
              label="システム売上（税込み）"
              value={yen(systemRevenueIncTax)}
              icon={<Coins className="w-4 h-4" />}
              hint={hasData ? "総売上 − 広告運用代行費" : dataHint}
            />
            <StatCard
              size="sm"
              accent="warning"
              label="広告運用代行費（税抜き）"
              value={yen(opFeeExTax)}
              icon={<Megaphone className="w-4 h-4" />}
              hint={
                hasData
                  ? sheetTotals.operationFeeExTax > 0
                    ? "税抜"
                    : "税率10%仮定"
                  : dataHint
              }
            />
            <StatCard
              size="sm"
              accent="warning"
              label="広告運用代行費（税込み）"
              value={yen(opFeeIncTax)}
              icon={<Megaphone className="w-4 h-4" />}
              hint={hasData ? "税込" : dataHint}
            />
          </div>
        </section>

        {/* Section: 実績 (3 activity tiles from localStorage + sheet) */}
        <section className="space-y-3">
          <SectionHeading title="実績" subtitle="当月の入退会サマリー" />
          <ActivityTiles
            month={month}
            cancelledCountFromSheet={sheetTotals.cancelledCount}
          />
        </section>

        {/* Section: 導入指標 (4 tiles) */}
        <section className="space-y-3">
          <SectionHeading title="導入指標" subtitle={monthLabel(month)} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              size="sm"
              label="総ブランド数"
              value={num(sheetTotals.brandCount)}
              icon={<Store className="w-4 h-4" />}
              hint={hasData ? "請求先合計" : dataHint}
            />
            <StatCard
              size="sm"
              label="店舗数"
              value={num(sheetTotals.storeCount)}
              icon={<Building2 className="w-4 h-4" />}
              hint={hasData ? `請求先サロン ${num(sheetTotals.customerCount)} 社` : dataHint}
            />
            <StatCard
              size="sm"
              label="口座振替"
              value={`${num(sheetTotals.transferCount)} 社`}
              icon={<Landmark className="w-4 h-4" />}
              hint={hasData ? `全体の ${transferRate}%` : dataHint}
            />
            <StatCard
              size="sm"
              label="請求書"
              value={`${num(sheetTotals.invoiceCount)} 社`}
              icon={<FileText className="w-4 h-4" />}
              hint={
                hasData
                  ? sheetTotals.invoiceCount > 0
                    ? `振替への移行対象`
                    : `全て振替済み`
                  : dataHint
              }
            />
          </div>
        </section>

        {!sheetTotals.configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-5 py-4">
            <div className="font-medium mb-1">実データを接続してください</div>
            <div className="text-xs leading-relaxed">
              このダッシュボードは請求書シート（Google Sheets + GAS Web App）から月次総計を取得します。
              Vercel の Project Settings → Environment Variables に
              <code className="font-mono"> SHEETS_GAS_URL_BILLING </code>
              と
              <code className="font-mono"> SHEETS_GAS_TOKEN_BILLING </code>
              を登録すると、この画面の各指標が自動で反映されます。
            </div>
          </div>
        )}
        {sheetTotals.configured && !hasData && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm px-5 py-4">
            <div className="font-medium mb-1">{monthLabel(month)}分のデータが見つかりませんでした</div>
            <div className="text-xs">
              シートのタブ名・トークン・列マッピングをご確認ください。上の月表示ピッカーで別の月に切替もできます。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
