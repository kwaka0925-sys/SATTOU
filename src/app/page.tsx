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
import { num, yen } from "@/lib/format";
import { fetchDashboardTotals, currentMonth } from "@/lib/sheets";

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

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentMonth();
  const sheetTotals = await fetchDashboardTotals(month);
  const hasData = sheetTotals.configured && sheetTotals.customerCount > 0;

  const revenueIncTax = sheetTotals.revenue;
  const revenueExTax = Math.round(revenueIncTax / 1.1);
  // システム売上 = 総売上 − 広告運用代行費（税込ベースで差し引いてから税抜換算）
  const systemRevenueIncTax = Math.max(
    revenueIncTax - sheetTotals.operationFeeIncTax,
    0,
  );
  const systemRevenueExTax = Math.round(systemRevenueIncTax / 1.1);
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

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>

        {/* Row 1: 総売上（税抜き / 税込み） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            size="sm"
            label="総売上（税抜き）"
            value={yen(revenueExTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={hasData ? "税率10%仮定" : dataHint}
          />
          <StatCard
            size="sm"
            label="総売上（税込み）"
            value={yen(revenueIncTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={dataHint}
          />
        </div>

        {/* Row 2: システム売上（税抜き / 税込み）と 広告運用代行費 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            size="sm"
            label="システム売上（税抜き）"
            value={yen(systemRevenueExTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={hasData ? "総売上 − 運用代行（税率10%仮定）" : dataHint}
          />
          <StatCard
            size="sm"
            label="システム売上（税込み）"
            value={yen(systemRevenueIncTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={hasData ? "総売上 − 運用代行" : dataHint}
          />
          <StatCard
            size="sm"
            label="広告運用代行費"
            value={yen(sheetTotals.operationFeeIncTax)}
            icon={<Megaphone className="w-4 h-4" />}
            hint={hasData ? "税込" : dataHint}
          />
        </div>

        {/* Row 2: 総ブランド数 / 店舗数 / 口座振替 / 請求書 */}
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
            hint={
              hasData
                ? `全体の ${transferRate}%`
                : dataHint
            }
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
