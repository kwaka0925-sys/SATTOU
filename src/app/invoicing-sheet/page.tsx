import EmbeddedSheetView from "@/components/EmbeddedSheetView";

const EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1rG1hSpd_Z7VKOCMfwhPik-QTH1e3ynD4mX6y0mqQeSw/edit?gid=1844006118#gid=1844006118";

export default function InvoicingSheetPage() {
  return (
    <EmbeddedSheetView
      title="請求書作成用スプシ"
      subtitle="各クライアントの請求書金額を作成するスプレッドシート"
      editUrl={EDIT_URL}
    />
  );
}
