import {
  fetchInvoicesFromSheetWithMeta,
  currentBillingMonth,
} from "@/lib/sheets";
import HpbAdditionsView from "./HpbAdditionsView";

export const dynamic = "force-dynamic";

// クライアント (店舗) 一覧はシートから取り込み、オートコンプリート候補にする。
// currentBillingMonth を叩けば最新の請求書タブが返り、そこにいる店舗名が
// そのまま候補になる。
export default async function HpbAdditionsPage() {
  const month = currentBillingMonth();
  const result = await fetchInvoicesFromSheetWithMeta(month);
  const salonNames = Array.from(
    new Set(result.rows.map((r) => r.clientName).filter(Boolean)),
  ).sort();
  return (
    <HpbAdditionsView
      year={new Date().getFullYear()}
      salonNames={salonNames}
    />
  );
}
