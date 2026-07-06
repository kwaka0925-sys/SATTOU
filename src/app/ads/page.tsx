import {
  fetchInvoicesFromSheet,
  currentMonth,
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
  const month = searchParams?.month ?? currentMonth();
  const rows = await fetchInvoicesFromSheet(month);
  const configured = isBackendConfigured("billing");
  return (
    <AdsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={false}
    />
  );
}
