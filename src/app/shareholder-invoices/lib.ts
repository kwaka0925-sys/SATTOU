// /shareholder-invoices とその配下の [month] 詳細ページで共有する型・定数・
// localStorage アクセスヘルパー。両ページから重複コピペしないように切り出している。

export const STORAGE_KEY = "sattou-shareholder-invoices";
export const SLOTS_PER_MONTH = 3;

// 3 クライアント枠に自動入力する既定のクライアント名。
// ユーザーがまだ触っていない月は、これを最初から入っている状態で表示する
// (ensureMonth 参照)。編集で消せば空になる。
export const DEFAULT_CLIENT_NAMES = [
  "10kol様",
  "T-Fitness様",
  "株式会社ミナト様",
];

export type Slot = {
  clientName: string;
  amount: string; // 入力途中を許容するため string。集計時に parseAmount で数値化
  paid: boolean;
  sheetUrl: string;
};

export type MonthData = { slots: Slot[] };

// キーは "YYYY-MM"。3 枠のスロット配列を固定で持つ。
export type Store = Record<string, MonthData>;

// 既定名で初期化した月データ。「未編集」状態はこれを画面上の値として表示する。
export function emptyMonth(): MonthData {
  return {
    slots: Array.from({ length: SLOTS_PER_MONTH }, (_, i) => ({
      clientName: DEFAULT_CLIENT_NAMES[i] ?? "",
      amount: "",
      paid: false,
      sheetUrl: "",
    })),
  };
}

// 保存済みが 3 枠未満・過剰の場合に整えるヘルパー。読み込み側で必ず通す。
// 「保存自体がない月」は既定の 3 クライアント名を入れて返す。
// 一度でも編集が保存された月はその値を尊重する (ユーザーが名前を消したなら
// 空のまま表示する)。
export function ensureMonth(store: Store, key: string): MonthData {
  const existing = store[key];
  if (!existing || !Array.isArray(existing.slots)) return emptyMonth();
  const slots = [...existing.slots];
  while (slots.length < SLOTS_PER_MONTH) {
    const i = slots.length;
    slots.push({
      clientName: DEFAULT_CLIENT_NAMES[i] ?? "",
      amount: "",
      paid: false,
      sheetUrl: "",
    });
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

// 年ごとに表示する月のリスト。
// 2026 年: 請求書発行を 5 月から開始する運用のため 5〜12 月のみ表示。
// それ以外: 通常の会計年度扱いで 1〜12 月を表示。
export function displayMonths(year: number): number[] {
  const start = year === 2026 ? 5 : 1;
  const arr: number[] = [];
  for (let m = start; m <= 12; m++) arr.push(m);
  return arr;
}
