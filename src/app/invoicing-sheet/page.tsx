import MonthlySheetsListView from "@/components/MonthlySheetsListView";

type SearchParams = { year?: string };

export default function InvoicingSheetPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const currentYear = new Date().getFullYear();
  const year = parseInt(
    searchParams?.year ?? String(currentYear),
    10,
  );
  return (
    <MonthlySheetsListView
      title="請求書作成用スプシ"
      subtitle="月ごとに請求書作成スプレッドシートを管理"
      basePath="/invoicing-sheet"
      storageKey="sattou-invoicing-sheets"
      year={Number.isFinite(year) ? year : currentYear}
    />
  );
}
