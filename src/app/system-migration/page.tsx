import {
  fetchClientsForMigration,
  fetchMigrationStatuses,
  isBackendConfigured,
} from "@/lib/sheets";
import SystemMigrationView from "./SystemMigrationView";

export const dynamic = "force-dynamic";

export default async function SystemMigrationPage() {
  // 新システム移行は月を跨いだ一度きりの作業なので、月切り替えは廃止。
  // クライアント一覧は fetchClientsForMigration が currentBillingMonth から
  // 遡って最初に見つかった非空シートを使う。
  const [result, initialMigrations] = await Promise.all([
    fetchClientsForMigration(),
    fetchMigrationStatuses(),
  ]);
  // 契約状況 (P 列) が「マーケのみ」または「解約」を含むクライアントは
  // システム移行の対象外なので、一覧・タイル集計・進捗率すべてから除外する。
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
      month={result.month}
      configured={configured}
      sheetName={result.sheetName}
      expectedSheets={result.expectedSheets}
      sheetMatched={result.sheetMatched}
      initialMigrations={initialMigrations}
    />
  );
}
