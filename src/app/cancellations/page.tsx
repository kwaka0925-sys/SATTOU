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

function yearMonths(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export default async function CancellationsPage() {
  const year = new Date().getFullYear();
  const months = yearMonths(year);
  const configured = isBackendConfigured("billing");

  const monthlyRows: MonthRows[] = await Promise.all(
    months.map(async (m) => ({
      month: m,
      rows: await fetchInvoicesForMonthStrict(m),
    })),
  );

  return (
    <CancellationsView
      monthlyRows={monthlyRows}
      configured={configured}
      year={year}
    />
  );
}
