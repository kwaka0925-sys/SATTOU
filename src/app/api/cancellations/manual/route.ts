import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 「解約追加」タブへの add/update/delete プロキシ。
// クライアントから { action: "add"|"update"|"delete", ... } を受け、
// 対応する GAS action を呼び出す。
type Body = {
  action?: "add" | "update" | "delete";
  id?: string;
  data?: Record<string, string>;
  patch?: Record<string, string>;
};

const ACTION_MAP: Record<string, string> = {
  add: "addManualCancellation",
  update: "updateManualCancellation",
  delete: "deleteManualCancellation",
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action;
  if (!action || !ACTION_MAP[action]) {
    return NextResponse.json(
      { error: `action must be one of: ${Object.keys(ACTION_MAP).join(", ")}` },
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

  const gasBody: Record<string, unknown> = {
    token,
    action: ACTION_MAP[action],
  };
  if (body.id) gasBody.id = body.id;
  if (body.data) gasBody.data = body.data;
  if (body.patch) gasBody.patch = body.patch;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gasBody),
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
      // 他のセッションにも次のアクセスで反映されるようキャッシュ無効化。
      revalidateTag("cancellations-manual");
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
