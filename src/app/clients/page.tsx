import {
  fetchInvoicesFromSheet,
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
  const rows = await fetchInvoicesFromSheet(month);
  const configured = isBackendConfigured("billing");
  return (
    <ClientsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={false}
    />
  );
}
