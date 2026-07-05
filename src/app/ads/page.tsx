import { fetchInvoicesFromSheet, currentMonth } from "@/lib/sheets";
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
  const configured = Boolean(
    process.env.SHEETS_GAS_URL && process.env.SHEETS_GAS_TOKEN,
  );
  return (
    <AdsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={false}
    />
  );
}
