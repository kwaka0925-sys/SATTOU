import {
  fetchInvoicesFromSheetWithMeta,
  fetchMigrationStatuses,
  currentBillingMonth,
  isBackendConfigured,
} from "@/lib/sheets";
import SystemMigrationView from "./SystemMigrationView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function SystemMigrationPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentBillingMonth();
  // クライアント一覧 (シートから) と、移行ステータス (共有シート) を並列で取得。
  // 移行ステータスはユーザー間で共有される値なので、常に GAS の最新を優先する。
  const [result, initialMigrations] = await Promise.all([
    fetchInvoicesFromSheetWithMeta(month),
    fetchMigrationStatuses(),
  ]);
  // 契約状況 (P 列) が「マーケのみ」または「解約」を含むクライアントは
  // システム移行の対象外なので、一覧・タイル集計・進捗率すべてから除外する。
  // マーケのみ: システムは使わずマーケ運用だけ受託しているクライアント
  // 解約     : 既に契約が切れているクライアント
  const rows = result.rows.filter((r) => {
    const status = (r.subscriptionStatus ?? "").trim();
    if (status === "マーケのみ") return false;
    if (status.includes("解約")) return false;
    return true;
  });
  const configured = isBackendConfigured("billing");
  return (
    <SystemMigrationView
      rows={rows}
      month={month}
      configured={configured}
      sheetName={result.sheetName}
      expectedSheets={result.expectedSheets}
      sheetMatched={result.sheetMatched}
      initialMigrations={initialMigrations}
    />
  );
}
