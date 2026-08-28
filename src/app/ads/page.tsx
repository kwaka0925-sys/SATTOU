import {
  fetchInvoicesFromSheetWithMeta,
  currentBillingMonth,
  isBackendConfigured,
} from "@/lib/sheets";
import AdsView from "./AdsView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function AdsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentBillingMonth();
  const result = await fetchInvoicesFromSheetWithMeta(month);
  const configured = isBackendConfigured("billing");
  return (
    <AdsView
      rows={result.rows}
      month={month}
      configured={configured}
      isMock={false}
      sheetName={result.sheetName}
      expectedSheets={result.expectedSheets}
      sheetMatched={result.sheetMatched}
    />
  );
}
