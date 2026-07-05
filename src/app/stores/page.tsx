import { CLIENTS } from "@/lib/mock";
import StoresView from "./StoresView";

export type StoreRow = {
  order: number;
  identifier: string;
  clientId: string;
  clientName: string;
  brand: string;
  url: string;
  templateInstalled: string;
  cancelled: string;
  creative: string;
  marketer: string;
  systemDelivery: string;
  legacyUser: string;
  since: string;
  hpbLinked: string;
  initialSheetUrl: string;
};

const CREATIVES = ["完了", "制作中", "未着手", "リテイク中"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_\-]/g, "");
}

function buildMockRows(): StoreRow[] {
  return CLIENTS.map((c, i) => {
    const brandSlug = slugify(c.brand) || `brand-${(i % 12) + 1}`;
    const cancelled = c.status === "paused" ? "解約" : "継続";
    const templateInstalled = i < 4 ? "未" : "済";
    const creative = CREATIVES[i % CREATIVES.length];
    const systemDelivery =
      i % 7 === 0 ? "未" : `2026-${String(1 + (i % 6)).padStart(2, "0")}-15`;
    const legacyUser = i % 4 === 0 ? "はい" : "いいえ";
    const hpbLinked = i % 3 === 0 ? "連携" : "未連携";
    return {
      order: i + 1,
      identifier: `${brandSlug}_${c.id}`,
      clientId: c.id,
      clientName: c.name,
      brand: c.brand,
      url: `https://${brandSlug}.example.jp/${c.id}`,
      templateInstalled,
      cancelled,
      creative,
      marketer: c.representative,
      systemDelivery,
      legacyUser,
      since: legacyUser === "はい" ? "旧SATTOUから移行" : "",
      hpbLinked,
      initialSheetUrl: `https://docs.google.com/spreadsheets/example/${c.id}`,
    };
  });
}

export default function StoresPage() {
  const rows = buildMockRows();
  return <StoresView rows={rows} />;
}
