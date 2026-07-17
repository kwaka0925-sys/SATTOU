// /inquiries とその配下 [month] 詳細ページで共有する型・定数・
// localStorage アクセスヘルパー。中身の項目定義はまだユーザーから
// 未指定なので、汎用的な「エントリー = 任意のメモ + 作成時刻」の枠組みだけを
// 用意している。項目仕様が固まり次第 InquiryEntry を拡張する。

export const STORAGE_KEY = "sattou-inquiries";

// 集計期間は 2026 年 5 月から 1 年間 (2026-05 〜 2027-04)。
export const START_YEAR = 2026;
export const START_MONTH = 5;
export const MONTHS_COUNT = 12;

export type InquiryEntry = {
  id: string;
  // 中身の項目仕様が来るまでの汎用フィールド。項目確定後に置き換える。
  note?: string;
  createdAt: string;
};

export type InquiryMonth = { entries: InquiryEntry[] };

// キーは "YYYY-MM"。
export type Store = Record<string, InquiryMonth>;

export function emptyMonth(): InquiryMonth {
  return { entries: [] };
}

export function ensureMonth(store: Store, key: string): InquiryMonth {
  const existing = store[key];
  if (!existing || !Array.isArray(existing.entries)) return emptyMonth();
  return existing;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

// 2026-05 開始の 12 ヶ月分の月キーを返す。年またぎを含む (2027-04 まで)。
export function displayMonths(): Array<{
  year: number;
  month: number;
  key: string;
  label: string;
}> {
  const arr: Array<{
    year: number;
    month: number;
    key: string;
    label: string;
  }> = [];
  for (let i = 0; i < MONTHS_COUNT; i++) {
    const raw = START_MONTH + i; // 5, 6, ..., 16
    const year = START_YEAR + Math.floor((raw - 1) / 12);
    const month = ((raw - 1) % 12) + 1;
    arr.push({
      year,
      month,
      key: monthKey(year, month),
      label: monthLabel(year, month),
    });
  }
  return arr;
}

// URL の月キー "YYYY-MM" が上の displayMonths の範囲内かを判定。
// 詳細ページで範囲外を弾く用途。
export function isDisplayMonth(key: string): boolean {
  return displayMonths().some((m) => m.key === key);
}
