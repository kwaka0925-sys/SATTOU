import { fetchInvoicesFromSheet, currentMonth, monthRange, type SheetInvoice } from "@/lib/sheets";
import { CLIENTS } from "@/lib/mock";
import type { Invoice } from "@/lib/types";
import ClientsView from "./ClientsView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

function synthesizeMockRows(month: string): SheetInvoice[] {
  const { issueDate, dueDate } = monthRange(month);
  return CLIENTS.map((c, i) => {
    const paymentMethod: "振替" | "請求書" = i % 3 === 0 ? "請求書" : "振替";
    const subscriptionStatus =
      c.status === "paused" ? "解約" : c.status === "trial" ? "トライアル" : "継続";
    const status: Invoice["status"] =
      c.status === "trial"
        ? "draft"
        : c.status === "paused"
        ? "unpaid"
        : i % 5 === 0
        ? "unpaid"
        : "paid";
    const brandCount = i % 6 === 0 ? 2 : 1;
    const storeCount = 1 + (i % 5);
    return {
      id: `MOCK-${c.id}`,
      clientId: c.id,
      clientName: c.name,
      issueDate,
      dueDate,
      amount: c.monthlyFee,
      status,
      items: [{ label: "運用代行費", quantity: 1, unitPrice: c.monthlyFee }],
      paymentMethod,
      subscriberId: c.id,
      payeeName: c.brand,
      subscriptionStatus,
      marketer: c.representative,
      brandCount,
      storeCount,
      progress: status === "paid" ? "入金済み" : undefined,
      bankTransferProgress:
        paymentMethod === "振替" && status === "paid" ? "完了" : undefined,
    };
  });
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentMonth();
  const sheetRows = await fetchInvoicesFromSheet(month);
  const configured = Boolean(
    process.env.SHEETS_GAS_URL && process.env.SHEETS_GAS_TOKEN,
  );
  const isMock = sheetRows.length === 0;
  const rows = isMock ? synthesizeMockRows(month) : sheetRows;
  return (
    <ClientsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={isMock}
    />
  );
}
