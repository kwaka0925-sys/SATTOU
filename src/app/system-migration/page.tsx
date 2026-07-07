import {
  fetchInvoicesFromSheetWithMeta,
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
  const result = await fetchInvoicesFromSheetWithMeta(month);
  const configured = isBackendConfigured("billing");
  return (
    <SystemMigrationView
      rows={result.rows}
      month={month}
      configured={configured}
      sheetName={result.sheetName}
      expectedSheets={result.expectedSheets}
      sheetMatched={result.sheetMatched}
    />
  );
}
