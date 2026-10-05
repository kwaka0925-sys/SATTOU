import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 新システム移行タブの upsert 用プロキシ。
// クライアントは 1 クライアント分の patch を送る (差分適用)。
// GAS 側は subscriberId をキーに、無ければ追加、あれば patch を当てる。
type Body = {
  subscriberId?: string;
  clientName?: string;
  patch?: {
    completed?: boolean;
    migrationDate?: string;
    plannedDate?: string;
    note?: string;
  };
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { subscriberId, clientName, patch } = body;

  if (!subscriberId || !patch) {
    return NextResponse.json(
      { error: "subscriberId and patch are required" },
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
        action: "upsertMigration",
        subscriberId,
        clientName: clientName ?? "",
        patch,
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
      // 他のセッションが次に開いた時に、この更新が確実に反映されるように
      // データキャッシュを無効化する。
      revalidateTag("migrations-sheet");
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
