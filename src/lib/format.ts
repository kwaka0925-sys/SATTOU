// 数値フォーマッタ。null/undefined/NaN が渡された時にクラッシュしないよう
// 0 扱いで安全にフォールバックする。
// (例: 広告費 API のレスポンスが欠けている行を描画する時など)
const safeNum = (n: number | null | undefined): number =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;

export const yen = (n: number | null | undefined) =>
  safeNum(n).toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  });

export const num = (n: number | null | undefined) =>
  safeNum(n).toLocaleString("ja-JP");

export const pct = (n: number | null | undefined, digits = 2) =>
  `${(safeNum(n) * 100).toFixed(digits)}%`;

export const ratio = (n: number | null | undefined, digits = 2) =>
  `${safeNum(n).toFixed(digits)}x`;

export const shortDate = (iso: string) => iso.slice(5).replace("-", "/");
