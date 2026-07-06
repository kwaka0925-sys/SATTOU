import EmbeddedSheetView from "@/components/EmbeddedSheetView";

const EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1esBZyZCjuZe4cb0-5--oBMEGdcfQ4coU3KsIz6bOuNI/edit?gid=755722710#gid=755722710";

export default function BankTransferSheetPage() {
  return (
    <EmbeddedSheetView
      title="口座振替用スプシ"
      subtitle="口座振替の管理スプレッドシート"
      editUrl={EDIT_URL}
    />
  );
}
