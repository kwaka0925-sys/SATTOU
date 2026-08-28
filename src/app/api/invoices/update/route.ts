import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// セル更新はほぼ即答なので短めで OK。GAS 側は 1〜2 秒で返る。
export const maxDuration = 30;

// UI からのセル更新リクエスト。1 セルずつ即時反映する。
// GAS 側の WRITEABLE_FIELDS と同じ集合を許可する。
const ALLOWED_FIELDS = new Set([
  "paymentMethod",
  "progress",
  "bankTransferProgress",
  "note",
  "subscriptionStatus",
  "marketer",
  "adSpend",
]);

type Body = {
  month?: string;
  subscriberId?: string;
  field?: string;
  value?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { month, subscriberId, field, value } = body;

  if (!month || !subscriberId || !field) {
    return NextResponse.json(
      { error: "month, subscriberId, field are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_FIELDS.has(field)) {
    return NextResponse.json(
      { error: `field not allowed: ${field}` },
      { status: 400 },
    );
  }

  // 請求書 GAS を優先し、無ければ既定の SHEETS_GAS_URL にフォールバック
  // (どちらか一方だけ設定してもよいように)。
  const url =
    process.env.SHEETS_GAS_URL_BILLING || process.env.SHEETS_GAS_URL;
  const token =
    process.env.SHEETS_GAS_TOKEN_BILLING || process.env.SHEETS_GAS_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      {
        error:
          "GAS 連携が未設定です。Vercel に SHEETS_GAS_URL_BILLING / SHEETS_GAS_TOKEN_BILLING (または SHEETS_GAS_URL / SHEETS_GAS_TOKEN) を登録してください。",
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
        action: "updateCell",
        month,
        subscriberId,
        field,
        value: value ?? "",
      }),
      cache: "no-store",
    });
    // GAS が HTML エラーページを返した場合の耐障害処理。
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
      // シート書き戻し成功時に fetchInvoicesFromSheetWithMeta の
      // データキャッシュを無効化。次に /clients や /ads を表示すると
      // 60 秒キャッシュを待たず、書き戻した内容が反映される。
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
