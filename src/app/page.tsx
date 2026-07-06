import { Coins, Store, Building2, Megaphone } from "lucide-react";
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
  const dataHint = hasData
    ? `${monthLabel(month)}分 · 請求書シート集計`
    : "実データ接続待ち";

  return (
    <div>
      <TopBar
        title="サット管理"
        subtitle={`SATTOU 経営指標サマリー — ${monthLabel(month)}分`}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>

        {/* Row 1: 総売上（税抜）/ 総売上（税込）/ 広告運用代行費 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="総売上（税抜き）"
            value={yen(revenueExTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={hasData ? `${dataHint} · 税率10%仮定` : dataHint}
          />
          <StatCard
            label="総売上（税込み）"
            value={yen(revenueIncTax)}
            icon={<Coins className="w-4 h-4" />}
            hint={dataHint}
          />
          <StatCard
            label="広告運用代行費"
            value={yen(sheetTotals.operationFeeIncTax)}
            icon={<Megaphone className="w-4 h-4" />}
            hint={hasData ? `${dataHint} · 税込` : dataHint}
          />
        </div>

        {/* Row 2: 総ブランド数 / 店舗数 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="総ブランド数"
            value={num(sheetTotals.brandCount)}
            icon={<Store className="w-4 h-4" />}
            hint={hasData ? "請求先合計" : dataHint}
          />
          <StatCard
            label="店舗数"
            value={num(sheetTotals.storeCount)}
            icon={<Building2 className="w-4 h-4" />}
            hint={hasData ? `請求先サロン ${num(sheetTotals.customerCount)} 社` : dataHint}
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
