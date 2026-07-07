import MonthlySheetsListView from "@/components/MonthlySheetsListView";

type SearchParams = { year?: string };

export default function BankTransferSheetPage({
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
      title="口座振替用スプシ"
      subtitle="月ごとに口座振替スプレッドシートを管理"
      basePath="/bank-transfer-sheet"
      storageKey="sattou-bank-transfer-sheets"
      year={Number.isFinite(year) ? year : currentYear}
    />
  );
}
