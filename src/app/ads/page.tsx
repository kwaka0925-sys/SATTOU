import {
  fetchInvoicesFromSheet,
  currentMonth,
  monthRange,
  type SheetInvoice,
} from "@/lib/sheets";
import { CLIENTS } from "@/lib/mock";
import type { Invoice } from "@/lib/types";
import AdsView from "./AdsView";

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

function synthesizeMockRows(month: string): SheetInvoice[] {
  const { issueDate, dueDate } = monthRange(month);
  return CLIENTS.map((c, i) => {
    const paymentMethod: "振替" | "請求書" = i % 3 === 0 ? "請求書" : "振替";
    const status: Invoice["status"] =
      c.status === "trial"
        ? "draft"
        : c.status === "paused"
        ? "unpaid"
        : i % 5 === 0
        ? "unpaid"
        : "paid";
    const adSpend = c.metrics30d.spend;
    const minAmount = 50000;
    const operationFeeExTax = Math.max(minAmount, Math.round(adSpend * 0.2));
    const operationFeeIncTax = Math.round(operationFeeExTax * 1.1);
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
      marketer: c.representative,
      brandCount: i % 6 === 0 ? 2 : 1,
      storeCount: 1 + (i % 5),
      adSpend,
      minAmount,
      operationFeeExTax,
      operationFeeIncTax,
    };
  });
}

export default async function AdsPage({
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
    <AdsView
      rows={rows}
      month={month}
      configured={configured}
      isMock={isMock}
    />
  );
}
