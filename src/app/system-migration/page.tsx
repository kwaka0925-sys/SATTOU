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
  const configured = isBackendConfigured("billing");
  return (
    <SystemMigrationView
      rows={result.rows}
      month={month}
      configured={configured}
      sheetName={result.sheetName}
      expectedSheets={result.expectedSheets}
      sheetMatched={result.sheetMatched}
      initialMigrations={initialMigrations}
    />
  );
}
