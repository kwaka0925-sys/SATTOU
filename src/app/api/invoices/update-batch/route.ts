import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// バッチ更新は 60〜150 件を 1 回で処理するので単セルよりは長め。GAS 側は
// 数秒〜十数秒。Vercel Pro のマージンとして 60 秒を確保。
export const maxDuration = 60;

// UI がまとめて更新するセルの集合。GAS 側 WRITEABLE_FIELDS と同じ集合。
const ALLOWED_FIELDS = new Set([
  "paymentMethod",
  "progress",
  "bankTransferProgress",
  "note",
  "subscriptionStatus",
  "marketer",
  "adSpend",
]);

type Item = {
  subscriberId?: string;
  field?: string;
  value?: string | number;
};

type Body = {
  month?: string;
  items?: Item[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { month, items } = body;

  if (!month || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "month and items[] are required" },
      { status: 400 },
    );
  }

  // 許可フィールドだけに絞り込む。呼び出し側のミスで書けない列に投げ込まれても
  // ここで弾く。
  const cleaned = items
    .map((it) => ({
      subscriberId: String(it.subscriberId ?? "").trim(),
      field: String(it.field ?? "").trim(),
      value: it.value == null ? "" : String(it.value),
    }))
    .filter(
      (it) => it.subscriberId && it.field && ALLOWED_FIELDS.has(it.field),
    );

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "no valid items after allowlist filter" },
      { status: 400 },
    );
  }

  const url =
    process.env.SHEETS_GAS_URL_BILLING || process.env.SHEETS_GAS_URL;
  const token =
    process.env.SHEETS_GAS_TOKEN_BILLING || process.env.SHEETS_GAS_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      {
        error:
          "GAS 連携が未設定です。Vercel に SHEETS_GAS_URL_BILLING / SHEETS_GAS_TOKEN_BILLING を登録してください。",
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action: "updateCells",
        month,
        items: cleaned,
      }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `GAS responded ${res.status}`, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }
    try {
      const data = JSON.parse(text);
      if (data.error) {
        return NextResponse.json(
          { error: data.error, detail: data },
          { status: 502 },
        );
      }
      // シート書き込み成功後は fetchInvoicesFromSheetWithMeta のキャッシュを
      // 無効化して、次に /ads や /clients を開いた時に新しい値を取り直させる。
      revalidateTag("invoices-sheet");
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        {
          error: "GAS が JSON ではないレスポンスを返しました。",
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown fetch error" },
      { status: 502 },
    );
  }
}
