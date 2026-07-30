import {
  fetchInvoicesForMonthStrict,
  fetchManualCancellations,
  isBackendConfigured,
  type ManualCancellation,
  type SheetInvoice,
} from "@/lib/sheets";
import CancellationsView from "./CancellationsView";

export const dynamic = "force-dynamic";

export type MonthRows = {
  month: string;
  rows: SheetInvoice[];
};

// 表示上の「解約月」= 実際に稼働を止めた月。
// 請求書シートは「翌月請求」運用なので、
//   表示 2026-03 の解約 = 2026-04 シート(3月稼働) の 継続=解約 行
// になる。この関数は表示月キー → シート月キー を返す。
function shiftedYearMonths(
  year: number,
): Array<{ displayMonth: string; sheetMonth: string }> {
  const arr: Array<{ displayMonth: string; sheetMonth: string }> = [];
  for (let m = 1; m <= 12; m++) {
    const displayMonth = `${year}-${String(m).padStart(2, "0")}`;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? year + 1 : year;
    const sheetMonth = `${nextY}-${String(nextM).padStart(2, "0")}`;
    arr.push({ displayMonth, sheetMonth });
  }
  return arr;
}

export default async function CancellationsPage() {
  const year = new Date().getFullYear();
  const months = shiftedYearMonths(year);
  const configured = isBackendConfigured("billing");

  // 請求書シート由来の月別解約 と、手動追加の解約 を並列取得。
  const [monthlyRows, manualCancellations] = await Promise.all([
    Promise.all(
      months.map(async ({ displayMonth, sheetMonth }) => ({
        month: displayMonth,
        rows: await fetchInvoicesForMonthStrict(sheetMonth),
      })),
    ),
    fetchManualCancellations(),
  ]) as [MonthRows[], ManualCancellation[]];

  return (
    <CancellationsView
      monthlyRows={monthlyRows}
      manualCancellations={manualCancellations}
      configured={configured}
      year={year}
    />
  );
}
