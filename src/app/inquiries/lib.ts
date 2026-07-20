// /inquiries とその配下 [month] 詳細ページで共有する型・定数・
// localStorage アクセスヘルパー。

export const STORAGE_KEY = "sattou-inquiries";

// 集計期間は 2026 年 5 月から 1 年間 (2026-05 〜 2027-04)。
export const START_YEAR = 2026;
export const START_MONTH = 5;
export const MONTHS_COUNT = 12;

// 面談結果。ドロップダウンで選択する 4 択 + 未設定 (空文字)。
// 月タイルの集計 (契約/断り/検討/キャンセル の各件数) はこの値でグルーピングする。
export const RESULT_OPTIONS = ["契約", "断り", "検討", "キャンセル"] as const;
export type InquiryResult = (typeof RESULT_OPTIONS)[number] | "";

// 契約プラン。面談結果が「契約」の場合にのみ選択可能な 3 択 + 未設定 (空文字)。
// 「断り」「検討」「未設定」の時はテーブル側で選択 UI 自体を非表示にする。
export const CONTRACT_PLAN_OPTIONS = [
  "システム＋マーケ",
  "システムのみ",
  "マーケのみ",
] as const;
export type ContractPlan = (typeof CONTRACT_PLAN_OPTIONS)[number] | "";

// 契約時の店舗数 (1〜10)。契約プランと同じく面談結果が「契約」の時だけ
// 選択可能。未選択は 0 で表現する。
export const STORE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type StoreCount = 0 | (typeof STORE_COUNT_OPTIONS)[number];

export type InquiryEntry = {
  id: string;
  meetingDateTime: string; // "YYYY-MM-DDTHH:MM" (datetime-local 用)
  name: string;
  phone: string;
  email: string;
  content: string; // 問い合わせフォームの本文
  note: string;
  result: InquiryResult;
  contractPlan: ContractPlan;
  storeCount: StoreCount;
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

// 新規エントリーを作る際の空データ。id と createdAt はコンポーネント側で付与する。
export function blankEntry(): Omit<InquiryEntry, "id" | "createdAt"> {
  return {
    meetingDateTime: "",
    name: "",
    phone: "",
    email: "",
    content: "",
    note: "",
    result: "",
    contractPlan: "",
    storeCount: 0,
  };
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

export function isDisplayMonth(key: string): boolean {
  return displayMonths().some((m) => m.key === key);
}

// 月あたりの集計。タイル画面と詳細画面のサマリー両方で使う。
export type MonthStats = {
  total: number;
  contracted: number; // 契約
  declined: number; // 断り
  considering: number; // 検討
  cancelled: number; // キャンセル
};

export function computeMonthStats(md: InquiryMonth): MonthStats {
  let contracted = 0;
  let declined = 0;
  let considering = 0;
  let cancelled = 0;
  for (const e of md.entries) {
    if (e.result === "契約") contracted++;
    else if (e.result === "断り") declined++;
    else if (e.result === "検討") considering++;
    else if (e.result === "キャンセル") cancelled++;
  }
  return {
    total: md.entries.length,
    contracted,
    declined,
    considering,
    cancelled,
  };
}

// 面談結果のバッジ色。契約=緑 / 断り=赤 / 検討=琥珀 / キャンセル=グレー(濃) / 未設定=灰(薄)。
export function resultPillClass(v: InquiryResult): string {
  if (v === "契約") return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  if (v === "断り") return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
  if (v === "検討") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (v === "キャンセル")
    return "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300";
  return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}

// 契約プランのバッジ色。面談結果の色 (緑/赤/琥珀) と被らないパレットを選ぶ。
export function contractPlanPillClass(v: ContractPlan): string {
  if (v === "システム＋マーケ")
    return "bg-violet-100 text-violet-800 ring-1 ring-violet-200";
  if (v === "システムのみ")
    return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
  if (v === "マーケのみ")
    return "bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200";
  return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}
