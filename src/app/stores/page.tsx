import {
  fetchStoresFromSheet,
  currentMonth,
  type StoreSheetRow,
} from "@/lib/sheets";
import StoresView from "./StoresView";

export type StoreRow = StoreSheetRow & { brand: string };

export const dynamic = "force-dynamic";

type SearchParams = { month?: string };

export default async function StoresPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const month = searchParams?.month ?? currentMonth();
  const result = await fetchStoresFromSheet(month);
  const rows: StoreRow[] = result.rows.map((r) => ({ ...r, brand: "" }));
  return (
    <StoresView
      rows={rows}
      configured={result.configured}
      sheetName={result.sheetName}
      month={month}
    />
  );
}
