// /shareholder-invoices とその配下の [month] 詳細ページで共有する型・定数・
// localStorage アクセスヘルパー。両ページから重複コピペしないように切り出している。

export const STORAGE_KEY = "sattou-shareholder-invoices";
export const SLOTS_PER_MONTH = 3;
// 請求書発行は 5 月から。それ以前の月はタイル一覧に表示しない。
export const FIRST_MONTH = 5;

export type Slot = {
  clientName: string;
  amount: string; // 入力途中を許容するため string。集計時に parseAmount で数値化
  paid: boolean;
  sheetUrl: string;
};

export type MonthData = { slots: Slot[] };

// キーは "YYYY-MM"。3 枠のスロット配列を固定で持つ。
export type Store = Record<string, MonthData>;

export function emptyMonth(): MonthData {
  return {
    slots: Array.from({ length: SLOTS_PER_MONTH }, () => ({
      clientName: "",
      amount: "",
      paid: false,
      sheetUrl: "",
    })),
  };
}

// 保存済みが 3 枠未満・過剰の場合に整えるヘルパー。読み込み側で必ず通す。
export function ensureMonth(store: Store, key: string): MonthData {
  const existing = store[key];
  if (!existing || !Array.isArray(existing.slots)) return emptyMonth();
  const slots = [...existing.slots];
  while (slots.length < SLOTS_PER_MONTH) {
    slots.push({ clientName: "", amount: "", paid: false, sheetUrl: "" });
  }
  return { slots: slots.slice(0, SLOTS_PER_MONTH) };
}

export function parseAmount(v: string): number {
  const cleaned = v.replace(/[¥,\s円]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

// 5 月〜12 月の 8 ヶ月分。年をまたぐ設計にはしていない (請求書発行が
// 5 月からしか発生しないという業務ルールに合わせている)。
export function displayMonths(): number[] {
  const arr: number[] = [];
  for (let m = FIRST_MONTH; m <= 12; m++) arr.push(m);
  return arr;
}
