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
  bankTransferProgress?: string;
  note?: string;
  subscriptionStatus?: string;
  marketer?: string;
};

export type DashboardTotals = {
  configured: boolean;
  month: string;
  sheetName?: string;
  revenue: number;
  customerCount: number;
  brandCount: number;
  storeCount: number;
};

export type SheetInvoice = Omit<Invoice, "clientId"> & {
  clientName: string;
  clientId: string | null;
  brandCount?: number;
  storeCount?: number;
  progress?: string;
  bankTransferProgress?: string;
};

const REVALIDATE_SECONDS = 60;

export function currentMonth(): string {
  const d = new Date();
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
  };
}

function isConfigured(): boolean {
  return Boolean(process.env.SHEETS_GAS_URL && process.env.SHEETS_GAS_TOKEN);
}

export async function fetchInvoicesFromSheet(
  month: string = currentMonth(),
): Promise<SheetInvoice[]> {
  if (!isConfigured()) return [];

  const url = new URL(process.env.SHEETS_GAS_URL!);
  url.searchParams.set("token", process.env.SHEETS_GAS_TOKEN!);
  url.searchParams.set("month", month);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["invoices-sheet"] },
    });
    if (!res.ok) {
      console.warn(`[sheets] GAS responded ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { rows?: SheetRow[]; error?: string };
    if (data.error) {
      console.warn(`[sheets] GAS error: ${data.error}`);
      return [];
    }
    const rows = data.rows ?? [];
    return rows
      .filter((r) => r.salonName && r.salonName.trim())
      .map((r) => rowToInvoice(r, month))
      .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  } catch (err) {
    console.warn("[sheets] fetch failed", err);
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
  };
  if (!isConfigured()) return empty;

  const url = new URL(process.env.SHEETS_GAS_URL!);
  url.searchParams.set("token", process.env.SHEETS_GAS_TOKEN!);
  url.searchParams.set("month", month);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["invoices-sheet"] },
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
    };
  } catch (err) {
    console.warn("[sheets] fetch failed", err);
    return { ...empty, configured: true };
  }
}

export async function findInvoiceById(id: string): Promise<SheetInvoice | null> {
  const m = id.match(/^INV-(\d{4})(\d{2})-/);
  if (!m) return null;
  const month = `${m[1]}-${m[2]}`;
  const rows = await fetchInvoicesFromSheet(month);
  return rows.find((r) => r.id === id) ?? null;
}
