export type ClientStatus = "active" | "paused" | "trial";

export type Industry =
  | "整体院"
  | "美容院"
  | "エステ"
  | "歯科医院"
  | "整骨院"
  | "鍼灸院"
  | "ジム";

export type DailyMetric = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  bookings: number;
};

export type InvoicePaymentMethod = "振替" | "請求書";

export type Invoice = {
  id: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "paid" | "unpaid" | "overdue" | "draft";
  items: {
    label: string;
    quantity: number;
    unitPrice: number;
  }[];
  paymentMethod?: InvoicePaymentMethod;
  subscriberId?: string;
  payeeName?: string;
  note?: string;
  subscriptionStatus?: string;
  marketer?: string;
};

export type Client = {
  id: string;
  name: string;
  representative: string;
  industry: Industry;
  prefecture: string;
  status: ClientStatus;
  monthlyFee: number;
  contractStart: string;
  metaAccountId: string;
  sattouAccountId: string;
  thumbnail?: string;
  metrics30d: {
    spend: number;
    impressions: number;
    clicks: number;
    bookings: number;
    completedVisits: number;
    revenue: number;
  };
  daily: DailyMetric[];
  invoices: Invoice[];
};
