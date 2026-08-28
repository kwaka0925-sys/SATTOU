import {
  fetchCancelledSubscriberIds,
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
  // 除外対象: 直近 12 ヶ月のどの月かで一度でも「解約」または「マーケのみ」に
  // なった加入者識別番号 (fetchCancelledSubscriberIds を横断スキャン)。
  const [result, initialMigrations, cancelledIds] = await Promise.all([
    fetchClientsForMigration(),
    fetchMigrationStatuses(),
    fetchCancelledSubscriberIds(),
  ]);
  const rows = result.rows.filter((r) => {
    const status = (r.subscriptionStatus ?? "").trim();
    // 最新月のシートで直接「マーケのみ / 解約」なら即除外。
    if (status === "マーケのみ") return false;
    if (status.includes("解約")) return false;
    // 過去のいずれかの月で解約 / マーケのみ になっていた場合も除外。
    const sid = (r.subscriberId ?? "").trim();
    if (sid && cancelledIds.has(sid)) return false;
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
