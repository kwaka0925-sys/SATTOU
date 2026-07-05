import { fetchInvoicesFromSheet, currentMonth } from "@/lib/sheets";
import ClientsView from "./ClientsView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function ClientsPage({
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
    <ClientsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={false}
    />
  );
}
