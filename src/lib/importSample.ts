export type ImportStatus = "振り込み済" | "請求書発行済" | "未払い" | "期限超過" | "下書き";

export type ImportRow = {
  no: number;
  invoiceId: string;
  clientName: string;
  industry: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: ImportStatus;
  paidDate?: string;
  note?: string;
};

export const SAMPLE_SHEET: ImportRow[] = [
  { no: 1, invoiceId: "INV-2026-041", clientName: "青葉整体院 新宿店", industry: "整体院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 165000, status: "振り込み済", paidDate: "2026-04-18", note: "—" },
  { no: 2, invoiceId: "INV-2026-042", clientName: "結いヘアサロン", industry: "美容院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 198000, status: "振り込み済", paidDate: "2026-04-22", note: "—" },
  { no: 3, invoiceId: "INV-2026-043", clientName: "ひかりエステサロン", industry: "エステ", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 132000, status: "請求書発行済", note: "メール送信済" },
  { no: 4, invoiceId: "INV-2026-044", clientName: "あおぞら整骨院", industry: "整骨院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 220000, status: "未払い", note: "リマインド要" },
  { no: 5, invoiceId: "INV-2026-045", clientName: "やすらぎ鍼灸院", industry: "鍼灸院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 110000, status: "振り込み済", paidDate: "2026-04-15", note: "—" },
  { no: 6, invoiceId: "INV-2026-046", clientName: "新緑デンタルオフィス", industry: "歯科医院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 275000, status: "請求書発行済", note: "—" },
  { no: 7, invoiceId: "INV-2026-047", clientName: "つばさパーソナルジム", industry: "ジム", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 187000, status: "振り込み済", paidDate: "2026-04-25", note: "—" },
  { no: 8, invoiceId: "INV-2026-048", clientName: "和心整体ラボ 梅田店", industry: "整体院", issueDate: "2026-03-01", dueDate: "2026-03-31", amount: 165000, status: "期限超過", note: "電話確認2回" },
  { no: 9, invoiceId: "INV-2026-049", clientName: "リフレ ボディケア", industry: "整体院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 154000, status: "未払い", note: "—" },
  { no: 10, invoiceId: "INV-2026-050", clientName: "桜美容室 駅前店", industry: "美容院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 209000, status: "振り込み済", paidDate: "2026-04-20", note: "—" },
  { no: 11, invoiceId: "INV-2026-051", clientName: "癒しサロン", industry: "エステ", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 121000, status: "請求書発行済", note: "—" },
  { no: 12, invoiceId: "INV-2026-052", clientName: "ハレ鍼灸院", industry: "鍼灸院", issueDate: "2026-04-01", dueDate: "2026-04-30", amount: 99000, status: "下書き", note: "金額確認中" },
];

export const STATUS_TO_INTERNAL: Record<ImportStatus, "paid" | "unpaid" | "overdue" | "draft"> = {
  振り込み済: "paid",
  請求書発行済: "unpaid",
  未払い: "unpaid",
  期限超過: "overdue",
  下書き: "draft",
};
