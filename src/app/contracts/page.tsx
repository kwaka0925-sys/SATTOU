import {
  fetchInvoicesFromSheet,
  currentMonth,
  isBackendConfigured,
  type SheetInvoice,
} from "@/lib/sheets";
import ContractsView from "./ContractsView";

export const dynamic = "force-dynamic";

export type ContractClient = {
  clientName: string;
  subscriberId: string;
};

export default async function ContractsPage() {
  const month = currentMonth();
  const rows: SheetInvoice[] = await fetchInvoicesFromSheet(month);
  const configured = isBackendConfigured("billing");
  const clients: ContractClient[] = rows.map((r) => ({
    clientName: r.clientName,
    subscriberId: r.subscriberId ?? "",
  }));
  return <ContractsView clients={clients} configured={configured} />;
}
