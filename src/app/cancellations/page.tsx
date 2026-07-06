import {
  fetchInvoicesForMonthStrict,
  isBackendConfigured,
  type SheetInvoice,
} from "@/lib/sheets";
import CancellationsView from "./CancellationsView";

export const dynamic = "force-dynamic";

export type MonthRows = {
  month: string;
  rows: SheetInvoice[];
};

function lastNMonths(n: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let month = now.getMonth() + 1 - i;
    let year = now.getFullYear();
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

export default async function CancellationsPage() {
  const months = lastNMonths(12);
  const configured = isBackendConfigured("billing");

  const monthlyRows: MonthRows[] = await Promise.all(
    months.map(async (m) => ({
      month: m,
      rows: await fetchInvoicesForMonthStrict(m),
    })),
  );

  return (
    <CancellationsView monthlyRows={monthlyRows} configured={configured} />
  );
}
