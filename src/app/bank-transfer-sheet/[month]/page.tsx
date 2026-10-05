import MonthlySheetEmbedView from "@/components/MonthlySheetEmbedView";

type Params = { month: string };

export default function BankTransferSheetMonthPage({
  params,
}: {
  params: Params;
}) {
  return (
    <MonthlySheetEmbedView
      title="口座振替用スプシ"
      basePath="/bank-transfer-sheet"
      storageKey="sattou-bank-transfer-sheets"
      month={params.month}
    />
  );
}
