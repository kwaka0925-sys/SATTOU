import { CLIENTS } from "./mock";
import type { Invoice, InvoicePaymentMethod } from "./types";

export type SheetRow = {
  rowIndex: number;
  salonName: string;
  brandCount?: number | string;
  storeCount?: number | string;
  paymentMethod?: string;
  subscriberId?: string;
  payeeName?: string;
  amount?: number | string;
  progress?: string;
  legacyUser?: boolean | string;
  bankTransferProgress?: string;
  note?: string;
  subscriptionStatus?: string;
  marketer?: string;
  otherAdSpendUrl?: string;
  adSpend?: number | string;
  minAmount?: number | string;
  operationFeeExTax?: number | string;
  operationFeeIncTax?: number | string;
};

export type DashboardTotals = {
  configured: boolean;
  month: string;
  sheetName?: string;
  revenue: number;
  customerCount: number;
  brandCount: number;
  storeCount: number;
  operationFeeExTax: number;
  operationFeeIncTax: number;
  transferCount: number;
  invoiceCount: number;
  cancelledCount: number;
  // 請求書払いの未入金 (進捗確認が「入金確認済み」でも「請求なし」でもない行) の
  // 件数と金額。/clients と同じ判定ロジック。
  unpaidCount: number;
  unpaidAmount: number;
};

export type SheetInvoice = Omit<Invoice, "clientId"> & {
  clientName: string;
  clientId: string | null;
  brandCount?: number;
  storeCount?: number;
  progress?: string;
  bankTransferProgress?: string;
  otherAdSpendUrl?: string;
  adSpend?: number;
  minAmount?: number;
  operationFeeExTax?: number;
  operationFeeIncTax?: number;
};

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ダッシュボード・請求書・広告売上のデフォルト月。
// 「今月の稼働分は翌月請求」の運用に合わせて、常に翌月を返す。
// 例: 今日が 2026-07-07 → 2026-08 (「2026年8月分（7月稼働分）」)
export function currentBillingMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string): { issueDate: string; dueDate: string } {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    issueDate: `${y}-${mm}-01`,
    dueDate: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

function parseAmount(v: number | string | undefined): number {
  if (typeof v === "number") return Math.round(v);
  if (!v) return 0;
  const cleaned = String(v).replace(/[¥,\s円]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizePaymentMethod(v: string | undefined): InvoicePaymentMethod | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (s.includes("振替")) return "振替";
  if (s.includes("請求書")) return "請求書";
  return undefined;
}

export function mapStatus(
  row: SheetRow,
  due: string,
): Invoice["status"] {
  const sub = (row.subscriptionStatus ?? "").trim();
  if (sub.includes("解約")) return "draft";

  const method = normalizePaymentMethod(row.paymentMethod);
  const progress = (row.progress ?? "").trim();
  const bank = (row.bankTransferProgress ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);

  const isPaid = (s: string) =>
    s.includes("完了") || s.includes("入金") || s.includes("済") || s.includes("成功");
  const isFailed = (s: string) =>
    s.includes("失敗") || s.includes("再請求") || s.includes("不能");

  if (method === "振替") {
    if (isPaid(bank) || isPaid(progress)) return "paid";
    if (isFailed(bank)) return "overdue";
  } else if (method === "請求書") {
    if (isPaid(progress)) return "paid";
  } else {
    if (isPaid(progress) || isPaid(bank)) return "paid";
  }

  if (today > due) return "overdue";
  return "unpaid";
}

function slug(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function resolveClientId(name: string): string | null {
  if (!name) return null;
  const target = slug(name);
  const match = CLIENTS.find((c) => slug(c.name) === target);
  if (match) return match.id;
  const partial = CLIENTS.find(
    (c) => slug(c.name).includes(target) || target.includes(slug(c.name)),
  );
  return partial ? partial.id : null;
}

export function rowToInvoice(row: SheetRow, month: string): SheetInvoice {
  const { issueDate, dueDate } = monthRange(month);
  const amount = parseAmount(row.amount);
  const status = mapStatus(row, dueDate);
  const paymentMethod = normalizePaymentMethod(row.paymentMethod);
  const id = `INV-${month.replace("-", "")}-${String(row.rowIndex).padStart(3, "0")}`;
  const clientId = resolveClientId(row.salonName);
  const brandCount = parseAmount(row.brandCount) || undefined;
  const storeCount = parseAmount(row.storeCount) || undefined;
  const adSpend = parseAmount(row.adSpend) || undefined;
  const minAmount = parseAmount(row.minAmount) || undefined;
  const operationFeeExTax = parseAmount(row.operationFeeExTax) || undefined;
  const operationFeeIncTax = parseAmount(row.operationFeeIncTax) || undefined;

  return {
    id,
    clientId,
    clientName: row.salonName,
    issueDate,
    dueDate,
    amount,
    status,
    items: [
      {
        label: paymentMethod === "振替" ? "広告運用代行費（口座振替）" : "広告運用代行費",
        quantity: 1,
        unitPrice: amount,
      },
    ],
    paymentMethod,
    subscriberId: row.subscriberId || undefined,
    payeeName: row.payeeName || undefined,
    note: row.note || undefined,
    subscriptionStatus: row.subscriptionStatus || undefined,
    marketer: row.marketer || undefined,
    brandCount,
    storeCount,
    progress: row.progress || undefined,
    bankTransferProgress: row.bankTransferProgress || undefined,
    otherAdSpendUrl: row.otherAdSpendUrl || undefined,
    adSpend,
    minAmount,
    operationFeeExTax,
    operationFeeIncTax,
  };
}

type GasBackend = "stores" | "billing";

// Return the {url, token} to use for a given backend.
// The billing backend prefers its dedicated env vars but falls back to the
// shared SHEETS_GAS_URL / SHEETS_GAS_TOKEN so setups with a single spreadsheet
// keep working.
function backendConfig(backend: GasBackend): {
  url?: string;
  token?: string;
} {
  if (backend === "billing") {
    return {
      url:
        process.env.SHEETS_GAS_URL_BILLING || process.env.SHEETS_GAS_URL,
      token:
        process.env.SHEETS_GAS_TOKEN_BILLING || process.env.SHEETS_GAS_TOKEN,
    };
  }
  return {
    url: process.env.SHEETS_GAS_URL,
    token: process.env.SHEETS_GAS_TOKEN,
  };
}

export function isBackendConfigured(backend: GasBackend): boolean {
  const cfg = backendConfig(backend);
  return Boolean(cfg.url && cfg.token);
}

function isConfigured(): boolean {
  return isBackendConfigured("stores");
}

// 新システム移行タブの 1 レコード。subscriberId を主キーに sattou 全ユーザー共有。
export type MigrationStatusRecord = {
  clientName: string;
  completed: boolean;
  migrationDate: string;
  plannedDate: string;
  note: string;
};

// 全ユーザー共有の「新システム移行」タブを読み込む。
// 返り値: { [subscriberId]: MigrationStatusRecord }
// GAS 側でタブが無ければ自動作成されるので、初回でも空マップが返る。
export async function fetchMigrationStatuses(): Promise<
  Record<string, MigrationStatusRecord>
> {
  const cfg = backendConfig("billing");
  if (!cfg.url || !cfg.token) return {};

  const url = new URL(cfg.url);
  url.searchParams.set("token", cfg.token);
  url.searchParams.set("action", "migrations");

  try {
    const res = await fetch(url.toString(), {
      // 他ユーザーの更新を確実に取り込むため、キャッシュはタグ経由で無効化。
      // 更新 API 側で revalidateTag("migrations-sheet") を呼ぶことで
      // 次回リクエストは必ず GAS を叩き直す。
      next: { revalidate: 30, tags: ["migrations-sheet"] },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      migrations?: Record<string, MigrationStatusRecord>;
      error?: string;
    };
    if (data.error) return {};
    return data.migrations ?? {};
  } catch (err) {
    console.warn("[sheets] migrations fetch failed", err);
    return {};
  }
}

export type InvoicesFetchResult = {
  rows: SheetInvoice[];
  sheetName?: string;
  expectedSheets: string[];
  sheetMatched: boolean;
};

// 内部関数: sheet 名とマッチ判定も返すバージョン。診断表示に使う。
export async function fetchInvoicesFromSheetWithMeta(
  month: string = currentMonth(),
): Promise<InvoicesFetchResult> {
  const expectedSheets = strictSheetPatternsForMonth(month);
  const empty: InvoicesFetchResult = {
    rows: [],
    expectedSheets,
    sheetMatched: false,
  };
  const cfg = backendConfig("billing");
  if (!cfg.url || !cfg.token) return empty;

  const url = new URL(cfg.url);
  url.searchParams.set("token", cfg.token);
  url.searchParams.set("month", month);

  try {
    // ページ遷移 (/clients ↔ /ads など) を速くするために 60 秒キャッシュ。
    // 双方向同期の鮮度は次の 3 経路で確保している:
    //   1. sattou 側の書き戻し成功時 → /api/invoices/update が revalidateTag
    //   2. タブフォーカス復帰時       → クライアントが /api/invoices/revalidate を叩いてから refresh
    //   3. 「シート更新」ボタン       → 同上
    // これにより、無編集の単純なページ切り替えはキャッシュヒットで瞬時、
    // 何か変化があった直後は必ず最新を取り直す構成になっている。
    const res = await fetch(url.toString(), {
      next: { revalidate: 60, tags: ["invoices-sheet"] },
    });
    if (!res.ok) {
      console.warn(`[sheets] GAS responded ${res.status}`);
      return empty;
    }
    const data = (await res.json()) as {
      rows?: SheetRow[];
      sheet?: string;
      error?: string;
    };
    if (data.error) {
      console.warn(`[sheets] GAS error: ${data.error}`);
      return empty;
    }
    const sheetName = data.sheet;
    const sheetMatched = !!sheetName && expectedSheets.includes(sheetName);
    const rows = data.rows ?? [];
    const invoices = rows
      .filter((r) => r.salonName && r.salonName.trim())
      .map((r) => rowToInvoice(r, month))
      .sort((a, b) => {
        const na = parseInt(a.subscriberId ?? "", 10);
        const nb = parseInt(b.subscriberId ?? "", 10);
        const aFin = Number.isFinite(na);
        const bFin = Number.isFinite(nb);
        if (aFin && bFin) return na - nb;
        if (aFin) return -1;
        if (bFin) return 1;
        return (a.subscriberId ?? "").localeCompare(b.subscriberId ?? "");
      });
    return { rows: invoices, sheetName, expectedSheets, sheetMatched };
  } catch (err) {
    console.warn("[sheets] fetch failed", err);
    return empty;
  }
}

export async function fetchInvoicesFromSheet(
  month: string = currentMonth(),
): Promise<SheetInvoice[]> {
  const { rows } = await fetchInvoicesFromSheetWithMeta(month);
  return rows;
}

// Sheet names that legitimately map to a specific month. Excludes generic
// fallback names (like "請求管理") so we can tell when the GAS returned
// the active sheet as a fallback for a month whose tab doesn't exist.
export function strictSheetPatternsForMonth(month: string): string[] {
  const [y, m] = month.split("-");
  const mNum = parseInt(m, 10);
  const opMonth = mNum === 1 ? 12 : mNum - 1;
  return [
    month,
    `${y}年${mNum}月_請求管理`,
    `${y}年${mNum}月`,
    `${y}年請求書${mNum}月`,
    `${y}年請求書${mNum}月（${opMonth}月稼働）`,
    `${y}年請求書${mNum}月(${opMonth}月稼働)`,
  ];
}

// Fetch a specific month's invoices, returning [] when GAS falls back to an
// unrelated sheet (i.e. the requested tab doesn't exist). Used by
// multi-month aggregation views like /cancellations.
export async function fetchInvoicesForMonthStrict(
  month: string,
): Promise<SheetInvoice[]> {
  const cfg = backendConfig("billing");
  if (!cfg.url || !cfg.token) return [];

  const url = new URL(cfg.url);
  url.searchParams.set("token", cfg.token);
  url.searchParams.set("month", month);

  try {
    // ページ遷移 (/clients ↔ /ads など) を速くするために 60 秒キャッシュ。
    // 双方向同期の鮮度は次の 3 経路で確保している:
    //   1. sattou 側の書き戻し成功時 → /api/invoices/update が revalidateTag
    //   2. タブフォーカス復帰時       → クライアントが /api/invoices/revalidate を叩いてから refresh
    //   3. 「シート更新」ボタン       → 同上
    // これにより、無編集の単純なページ切り替えはキャッシュヒットで瞬時、
    // 何か変化があった直後は必ず最新を取り直す構成になっている。
    const res = await fetch(url.toString(), {
      next: { revalidate: 60, tags: ["invoices-sheet"] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      rows?: SheetRow[];
      sheet?: string;
      error?: string;
    };
    if (data.error) return [];
    const expected = strictSheetPatternsForMonth(month);
    if (!data.sheet || !expected.includes(data.sheet)) return [];
    return (data.rows ?? [])
      .filter((r) => r.salonName && r.salonName.trim())
      .map((r) => rowToInvoice(r, month));
  } catch (err) {
    console.warn("[sheets] strict fetch failed", err);
    return [];
  }
}

export async function fetchDashboardTotals(
  month: string = currentMonth(),
): Promise<DashboardTotals> {
  const empty: DashboardTotals = {
    configured: false,
    month,
    revenue: 0,
    customerCount: 0,
    brandCount: 0,
    storeCount: 0,
    operationFeeExTax: 0,
    operationFeeIncTax: 0,
    transferCount: 0,
    invoiceCount: 0,
    cancelledCount: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
  };
  const cfg = backendConfig("billing");
  if (!cfg.url || !cfg.token) return empty;

  const url = new URL(cfg.url);
  url.searchParams.set("token", cfg.token);
  url.searchParams.set("month", month);

  try {
    // ページ遷移 (/clients ↔ /ads など) を速くするために 60 秒キャッシュ。
    // 双方向同期の鮮度は次の 3 経路で確保している:
    //   1. sattou 側の書き戻し成功時 → /api/invoices/update が revalidateTag
    //   2. タブフォーカス復帰時       → クライアントが /api/invoices/revalidate を叩いてから refresh
    //   3. 「シート更新」ボタン       → 同上
    // これにより、無編集の単純なページ切り替えはキャッシュヒットで瞬時、
    // 何か変化があった直後は必ず最新を取り直す構成になっている。
    const res = await fetch(url.toString(), {
      next: { revalidate: 60, tags: ["invoices-sheet"] },
    });
    if (!res.ok) {
      console.warn(`[sheets] GAS responded ${res.status}`);
      return { ...empty, configured: true };
    }
    const data = (await res.json()) as {
      rows?: SheetRow[];
      sheet?: string;
      error?: string;
    };
    if (data.error) {
      console.warn(`[sheets] GAS error: ${data.error}`);
      return { ...empty, configured: true };
    }
    const rows = (data.rows ?? []).filter(
      (r) => r.salonName && r.salonName.trim(),
    );
    return {
      configured: true,
      month,
      sheetName: data.sheet,
      revenue: rows.reduce((s, r) => s + parseAmount(r.amount), 0),
      customerCount: rows.length,
      brandCount: rows.reduce((s, r) => s + parseAmount(r.brandCount), 0),
      storeCount: rows.reduce((s, r) => s + parseAmount(r.storeCount), 0),
      operationFeeExTax: rows.reduce(
        (s, r) => s + parseAmount(r.operationFeeExTax),
        0,
      ),
      operationFeeIncTax: rows.reduce(
        (s, r) => s + parseAmount(r.operationFeeIncTax),
        0,
      ),
      transferCount: rows.filter((r) =>
        (r.paymentMethod ?? "").includes("振替"),
      ).length,
      invoiceCount: rows.filter((r) =>
        (r.paymentMethod ?? "").includes("請求書"),
      ).length,
      cancelledCount: rows.filter((r) =>
        (r.subscriptionStatus ?? "").includes("解約"),
      ).length,
      // /clients の未入金判定に揃える: 請求書払い かつ 「入金確認済み」でも「請求なし」でもない行。
      unpaidCount: rows.filter((r) => {
        const pm = (r.paymentMethod ?? "").includes("請求書");
        const progress = (r.progress ?? "").trim();
        return pm && progress !== "入金確認済み" && progress !== "請求なし";
      }).length,
      unpaidAmount: rows.reduce((s, r) => {
        const pm = (r.paymentMethod ?? "").includes("請求書");
        const progress = (r.progress ?? "").trim();
        const isUnpaid =
          pm && progress !== "入金確認済み" && progress !== "請求なし";
        return isUnpaid ? s + parseAmount(r.amount) : s;
      }, 0),
    };
  } catch (err) {
    console.warn("[sheets] fetch failed", err);
    return { ...empty, configured: true };
  }
}

// Build a subscriberId → salonName lookup by scanning the most recent N
// billing months. The most recent month's mapping wins in case of drift.
// Used by /store-additions and /new-registrations to auto-fill the brand
// name field when the operator types an existing subscriber id.
export async function fetchSubscriberBrandMap(
  monthsToScan: number = 6,
): Promise<Record<string, string>> {
  const cfg = backendConfig("billing");
  if (!cfg.url || !cfg.token) return {};

  const months: string[] = [];
  const d = new Date();
  // Start from the current billing month (今月+1) and walk backwards.
  d.setMonth(d.getMonth() + 1);
  for (let i = 0; i < monthsToScan; i++) {
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
    d.setMonth(d.getMonth() - 1);
  }

  const results = await Promise.all(
    months.map((m) => fetchInvoicesForMonthStrict(m)),
  );

  const map: Record<string, string> = {};
  // months is newest-first; iterate in that order and keep the first hit so
  // the newest sheet wins.
  results.forEach((rows) => {
    rows.forEach((r) => {
      const sid = (r.subscriberId ?? "").trim();
      if (!sid) return;
      if (map[sid]) return;
      const name = (r.clientName ?? "").trim();
      if (!name) return;
      map[sid] = name;
    });
  });
  return map;
}

export type StoreSheetRow = {
  order: number;
  identifier: string;
  clientId: string | null;
  clientName: string;
  url: string;
  cancelled: string;
  marketer: string;
  systemDelivery: string;
  legacyUser: boolean;
  hpbLinked: string;
  initialSheetUrl: string;
};

function isTruthyFlag(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (!s || s === "false" || s === "no" || s === "0") return false;
    return true;
  }
  return false;
}

function formatDeliveryDate(v: unknown): string {
  if (v == null || v === "" || v === 0) return "";
  const s = typeof v === "number" ? String(v) : String(v).trim();
  if (!s) return "";

  // ISO or slash: 2026-10-15 / 2026/10/15
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)} 導入済み`;

  // Japanese: 10月15日 (with or without suffix)
  m = s.match(/^(\d{1,2})月(\d{1,2})日/);
  if (m) return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)} 導入済み`;

  // Slash: 10/15 or 10/15/2026
  m = s.match(/^(\d{1,2})[/](\d{1,2})/);
  if (m) return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)} 導入済み`;

  return s;
}

export type StoreSheetResult = {
  configured: boolean;
  sheetName?: string;
  rows: StoreSheetRow[];
};

// Reinterpret the sheet columns for the "sattou導入店舗" view:
//   A → order        (was salonName in billing mapping)
//   E → clientName   (was subscriberId)
//   F → url          (was payeeName)
//   Q → identifier   (was marketer)
//   N → hpbLinked    (was bankTransferProgress; often ✓)
//   P → cancelled/継続 (was subscriptionStatus)
export async function fetchStoresFromSheet(
  month: string = currentMonth(),
): Promise<StoreSheetResult> {
  const cfg = backendConfig("stores");
  if (!cfg.url || !cfg.token) return { configured: false, rows: [] };

  const url = new URL(cfg.url);
  url.searchParams.set("token", cfg.token);
  url.searchParams.set("month", month);

  try {
    // ページ遷移 (/clients ↔ /ads など) を速くするために 60 秒キャッシュ。
    // 双方向同期の鮮度は次の 3 経路で確保している:
    //   1. sattou 側の書き戻し成功時 → /api/invoices/update が revalidateTag
    //   2. タブフォーカス復帰時       → クライアントが /api/invoices/revalidate を叩いてから refresh
    //   3. 「シート更新」ボタン       → 同上
    // これにより、無編集の単純なページ切り替えはキャッシュヒットで瞬時、
    // 何か変化があった直後は必ず最新を取り直す構成になっている。
    const res = await fetch(url.toString(), {
      next: { revalidate: 60, tags: ["invoices-sheet"] },
    });
    if (!res.ok) {
      console.warn(`[sheets] GAS responded ${res.status}`);
      return { configured: true, rows: [] };
    }
    const data = (await res.json()) as {
      rows?: SheetRow[];
      sheet?: string;
      error?: string;
    };
    if (data.error) {
      console.warn(`[sheets] GAS error: ${data.error}`);
      return { configured: true, sheetName: data.sheet, rows: [] };
    }
    const rows = (data.rows ?? []).filter(
      (r) => (r.subscriberId ?? "").trim() || (r.salonName ?? "").trim(),
    );
    const stores: StoreSheetRow[] = rows.map((r, i) => {
      const clientName =
        (r.subscriberId ?? "").trim() ||
        (typeof r.salonName === "string" ? r.salonName.trim() : "") ||
        "—";
      const identifier = (r.marketer ?? "").trim();
      const urlValue = (r.payeeName ?? "").trim();
      const orderRaw =
        typeof r.salonName === "string" ? parseInt(r.salonName, 10) : NaN;
      const order = Number.isFinite(orderRaw) ? orderRaw : i + 1;
      const hpbLinked = (r.bankTransferProgress ?? "").trim() || "—";
      const clientId = resolveClientId(clientName);
      const systemDelivery = formatDeliveryDate(r.amount);
      return {
        order,
        identifier,
        clientId,
        clientName,
        url: urlValue,
        cancelled: "",
        marketer: identifier,
        systemDelivery,
        legacyUser: isTruthyFlag(r.legacyUser),
        hpbLinked,
        initialSheetUrl: (r.otherAdSpendUrl ?? "").trim(),
      };
    });
    return {
      configured: true,
      sheetName: data.sheet,
      rows: stores,
    };
  } catch (err) {
    console.warn("[sheets] fetch failed", err);
    return { configured: true, rows: [] };
  }
}

export async function findInvoiceById(id: string): Promise<SheetInvoice | null> {
  const m = id.match(/^INV-(\d{4})(\d{2})-/);
  if (!m) return null;
  const month = `${m[1]}-${m[2]}`;
  const rows = await fetchInvoicesFromSheet(month);
  return rows.find((r) => r.id === id) ?? null;
}
