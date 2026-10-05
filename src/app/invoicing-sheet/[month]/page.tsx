import MonthlySheetEmbedView from "@/components/MonthlySheetEmbedView";

type Params = { month: string };

export default function InvoicingSheetMonthPage({
  params,
}: {
  params: Params;
}) {
  return (
    <MonthlySheetEmbedView
      title="請求書作成用スプシ"
      basePath="/invoicing-sheet"
      storageKey="sattou-invoicing-sheets"
      month={params.month}
    />
  );
}
