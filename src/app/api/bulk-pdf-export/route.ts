import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Google Sheets の PDF エクスポート + Drive アップロードは重い処理。
// 60 タブ超のシート (口座振替 150+ タブなど) では GAS 側が 4.5 分近くまで
// 走る必要があるので、Vercel Pro の上限 300 秒まで引き上げる。
// これより短いと、GAS が JSON を返す前に Vercel が 504 を返してしまう。
export const maxDuration = 300;

type Body = {
  sheetUrl?: string;
  folderUrl?: string;
  fileNamePrefix?: string;
  subfolderName?: string;
  excludeHidden?: boolean;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const {
    sheetUrl,
    folderUrl,
    fileNamePrefix,
    subfolderName,
    excludeHidden,
  } = body;

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
        subfolderName: subfolderName ?? "",
        excludeHidden: excludeHidden !== false,
      }),
      // GAS 側で数秒〜数分かかる可能性があるのでキャッシュ無効
      cache: "no-store",
    });
    // GAS が6分制限で強制停止された場合や、例外を出した場合は
    // HTML の "An error occurred" ページを返してくる。JSON.parse を
    // そのまま呼ぶと "Unexpected token" になるので、text 先読みで
    // 判別してから JSON パースを試みる。
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `GAS responded ${res.status}`,
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        {
          error:
            "GAS が JSON ではないエラーページを返しました。実行時間制限 (6分) 超過の可能性が高いです。GAS 側で自動リトライロジックを縮小しています。既に生成された PDF はスキップされるので、もう一度「一括PDF出力」を押して残りを処理してください。",
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown fetch error",
      },
      { status: 502 },
    );
  }
}
