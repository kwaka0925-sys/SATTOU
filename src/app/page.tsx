import { Coins, Users, Store } from "lucide-react";
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

  return (
    <div>
      <TopBar
        title="ダッシュボード"
        subtitle={`SATTOU 経営指標サマリー — ${monthLabel(month)}分`}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <MonthPicker current={month} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="総売上"
            value={yen(sheetTotals.revenue)}
            icon={<Coins className="w-4 h-4" />}
            hint={hasData ? `${monthLabel(month)}分 · 請求書シート集計` : "実データ接続待ち"}
          />
          <StatCard
            label="総顧客数"
            value={num(sheetTotals.customerCount)}
            icon={<Users className="w-4 h-4" />}
            hint={hasData ? "請求先サロン" : "実データ接続待ち"}
          />
          <StatCard
            label="総ブランド数"
            value={num(sheetTotals.brandCount)}
            icon={<Store className="w-4 h-4" />}
            hint={
              hasData
                ? sheetTotals.storeCount
                  ? `店舗数 ${num(sheetTotals.storeCount)}`
                  : "請求先合計"
                : "実データ接続待ち"
            }
          />
        </div>

        {!sheetTotals.configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-5 py-4">
            <div className="font-medium mb-1">実データを接続してください</div>
            <div className="text-xs leading-relaxed">
              このダッシュボードは請求書シート（Google Sheets + GAS Web App）から月次総計を取得します。
              Vercel の Project Settings → Environment Variables に
              <code className="font-mono"> SHEETS_GAS_URL </code>
              と
              <code className="font-mono"> SHEETS_GAS_TOKEN </code>
              を登録すると、この画面の総売上・総顧客数・総ブランド数が自動で反映されます。詳細は README の「GAS連携」セクションを参照。
            </div>
          </div>
        )}
        {sheetTotals.configured && !hasData && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm px-5 py-4">
            <div className="font-medium mb-1">{monthLabel(month)}分のデータが見つかりませんでした</div>
            <div className="text-xs">
              シートのタブ名・トークン・列マッピングをご確認ください。
              <code className="font-mono"> ?month=YYYY-MM </code>
              で別の月を指定できます。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
