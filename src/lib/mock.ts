import type { Client, ClientStatus, DailyMetric, Industry, Invoice } from "./types";

const NAMES_PREFIX = [
  "青葉", "結い", "あおぞら", "ひかり", "やすらぎ", "新緑", "つばさ", "和心", "リフレ", "桜", "癒し", "ハレ", "リラ", "wabi", "リカバリー",
  "Re:", "comfy", "なごみ", "ふれあい", "ホリスティック", "ことぶき", "悠", "凛", "ヒーリング", "せせらぎ", "輝", "雅", "穏", "nuance", "Lien",
];
const NAMES_SUFFIX_BY_INDUSTRY: Record<Industry, string[]> = {
  整体院: ["整体院", "整体ラボ", "整体スタジオ", "ボディケア"],
  美容院: ["ヘアサロン", "美容室", "Hair Atelier"],
  エステ: ["エステ", "ビューティーサロン", "サロン"],
  歯科医院: ["歯科クリニック", "デンタルオフィス", "歯科"],
  整骨院: ["整骨院", "接骨院"],
  鍼灸院: ["鍼灸院", "はり灸院"],
  ジム: ["ジム", "フィットネス", "パーソナルジム"],
};
const PREFECTURES = [
  "東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府", "兵庫県", "愛知県", "福岡県", "北海道",
  "宮城県", "広島県", "静岡県", "新潟県", "岡山県",
];
const REPS_FIRST = ["健", "理沙", "翔太", "由美", "拓海", "綾", "亮", "美咲", "雄一", "彩", "大輔", "麻衣", "和也", "桃子", "悠斗"];
const REPS_LAST = ["山田", "佐藤", "鈴木", "高橋", "田中", "伊藤", "中村", "小林", "加藤", "渡辺", "吉田", "山本", "斎藤", "松本", "井上"];

const INDUSTRIES: Industry[] = ["整体院", "美容院", "エステ", "歯科医院", "整骨院", "鍼灸院", "ジム"];

// Deterministic pseudo-random so output is stable across renders.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDaily(seed: number, baseSpend: number, baseBookingRate: number): DailyMetric[] {
  const r = rng(seed);
  const out: DailyMetric[] = [];
  const today = new Date("2026-04-26");
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const wave = 1 + Math.sin(i / 4) * 0.15;
    const noise = 0.85 + r() * 0.3;
    const spend = Math.round(baseSpend * wave * noise);
    const impressions = Math.round(spend * (18 + r() * 6));
    const clicks = Math.round(impressions * (0.012 + r() * 0.018));
    const bookings = Math.max(0, Math.round(clicks * baseBookingRate * (0.7 + r() * 0.6)));
    out.push({
      date: fmtDate(d),
      spend,
      impressions,
      clicks,
      bookings,
    });
  }
  return out;
}

function buildInvoices(seed: number, clientId: string, monthlyFee: number): Invoice[] {
  const r = rng(seed + 99);
  const months = [
    { issue: "2026-02-01", due: "2026-02-28", status: "paid" as const },
    { issue: "2026-03-01", due: "2026-03-31", status: "paid" as const },
    { issue: "2026-04-01", due: "2026-04-30", status: r() > 0.4 ? ("paid" as const) : ("unpaid" as const) },
  ];
  return months.map((m, idx) => {
    const adFee = monthlyFee;
    const reportFee = 30000;
    const optionFee = r() > 0.7 ? 50000 : 0;
    const items = [
      { label: "広告運用代行費", quantity: 1, unitPrice: adFee },
      { label: "レポーティング・コンサル", quantity: 1, unitPrice: reportFee },
    ];
    if (optionFee) items.push({ label: "LP改善オプション", quantity: 1, unitPrice: optionFee });
    return {
      id: `INV-${clientId}-${idx + 1}`,
      clientId,
      issueDate: m.issue,
      dueDate: m.due,
      amount: items.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
      status: m.status,
      items,
    };
  });
}

function buildClient(i: number): Client {
  const r = rng(i * 7919 + 13);
  const industry = pick(INDUSTRIES, r);
  const prefix = pick(NAMES_PREFIX, r);
  const suffix = pick(NAMES_SUFFIX_BY_INDUSTRY[industry], r);
  const branchTag = r() > 0.7 ? ` ${pick(["新宿店", "梅田店", "本店", "駅前店", "東口店"], r)}` : "";
  const name = `${prefix}${suffix}${branchTag}`;
  const status: ClientStatus = r() > 0.92 ? "trial" : r() > 0.88 ? "paused" : "active";
  const monthlyFee = 100000 + Math.floor(r() * 9) * 50000;
  const baseSpend = 8000 + Math.floor(r() * 22000);
  const baseBookingRate = 0.05 + r() * 0.12;

  const daily = buildDaily(i, baseSpend, baseBookingRate);
  const totals = daily.reduce(
    (acc, d) => ({
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      bookings: acc.bookings + d.bookings,
    }),
    { spend: 0, impressions: 0, clicks: 0, bookings: 0 },
  );
  const completionRate = 0.55 + r() * 0.3;
  const completedVisits = Math.round(totals.bookings * completionRate);
  const arpu = 4500 + Math.floor(r() * 5500);
  const revenue = completedVisits * arpu;

  const repName = `${pick(REPS_LAST, r)} ${pick(REPS_FIRST, r)}`;
  const id = String(i + 1).padStart(4, "0");

  const startYear = 2023 + Math.floor(r() * 3);
  const startMonth = 1 + Math.floor(r() * 12);

  return {
    id,
    name,
    representative: repName,
    industry,
    prefecture: pick(PREFECTURES, r),
    status,
    monthlyFee,
    contractStart: `${startYear}-${String(startMonth).padStart(2, "0")}-01`,
    metaAccountId: `act_${100000000 + Math.floor(r() * 899999999)}`,
    sattouAccountId: `sattou_${id}`,
    metrics30d: {
      ...totals,
      completedVisits,
      revenue,
    },
    daily,
    invoices: buildInvoices(i, id, monthlyFee),
  };
}

export const CLIENTS: Client[] = Array.from({ length: 64 }, (_, i) => buildClient(i));

export function getClient(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}

export function totalsAll(clients: Client[] = CLIENTS) {
  const t = clients.reduce(
    (acc, c) => ({
      spend: acc.spend + c.metrics30d.spend,
      bookings: acc.bookings + c.metrics30d.bookings,
      clicks: acc.clicks + c.metrics30d.clicks,
      impressions: acc.impressions + c.metrics30d.impressions,
      revenue: acc.revenue + c.metrics30d.revenue,
      completedVisits: acc.completedVisits + c.metrics30d.completedVisits,
    }),
    { spend: 0, bookings: 0, clicks: 0, impressions: 0, revenue: 0, completedVisits: 0 },
  );
  return {
    ...t,
    cpa: t.bookings ? Math.round(t.spend / t.bookings) : 0,
    ctr: t.impressions ? t.clicks / t.impressions : 0,
    cvr: t.clicks ? t.bookings / t.clicks : 0,
    roas: t.spend ? t.revenue / t.spend : 0,
  };
}

export function clientCpa(c: Client): number {
  return c.metrics30d.bookings ? Math.round(c.metrics30d.spend / c.metrics30d.bookings) : 0;
}

export function clientRoas(c: Client): number {
  return c.metrics30d.spend ? c.metrics30d.revenue / c.metrics30d.spend : 0;
}

export function clientCvr(c: Client): number {
  return c.metrics30d.clicks ? c.metrics30d.bookings / c.metrics30d.clicks : 0;
}
