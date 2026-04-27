export const yen = (n: number) =>
  n.toLocaleString("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

export const num = (n: number) => n.toLocaleString("ja-JP");

export const pct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;

export const ratio = (n: number, digits = 2) => `${n.toFixed(digits)}x`;

export const shortDate = (iso: string) => iso.slice(5).replace("-", "/");
