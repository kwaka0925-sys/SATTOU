import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Google Sheets の PDF エクスポート + Drive アップロードは重い処理なので、
// タイムアウトを長めに確保 (Vercel Pro でも 60s 上限)。
export const maxDuration = 60;

type Body = {
  sheetUrl?: string;
  folderUrl?: string;
  fileNamePrefix?: string;
  excludeHidden?: boolean;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { sheetUrl, folderUrl, fileNamePrefix, excludeHidden } = body;

  if (!sheetUrl || !folderUrl || !fileNamePrefix) {
    return NextResponse.json(
      {
        error:
          "sheetUrl, folderUrl, fileNamePrefix are required in JSON body.",
      },
      { status: 400 },
    );
  }

  const url = process.env.SHEETS_GAS_URL_BULK_PDF;
  const token = process.env.SHEETS_GAS_TOKEN_BULK_PDF;
  if (!url || !token) {
    return NextResponse.json(
      {
        error:
          "一括PDF出力用の GAS が設定されていません。Vercel に SHEETS_GAS_URL_BULK_PDF / SHEETS_GAS_TOKEN_BULK_PDF を登録してください。",
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
        sheetUrl,
        folderUrl,
        fileNamePrefix,
        excludeHidden: excludeHidden !== false,
      }),
      // GAS 側で数秒〜数分かかる可能性があるのでキャッシュ無効
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `GAS responded ${res.status}`,
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown fetch error",
      },
      { status: 502 },
    );
  }
}
