import {
  fetchInvoicesFromSheetWithMeta,
  currentMonth,
  isBackendConfigured,
} from "@/lib/sheets";
import ClientsView from "./ClientsView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentMonth();
  const result = await fetchInvoicesFromSheetWithMeta(month);
  const configured = isBackendConfigured("billing");
  return (
    <ClientsView
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
