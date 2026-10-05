import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 「シート更新」ボタンやタブフォーカス復帰時にクライアントから叩く軽量エンドポイント。
// fetchInvoicesFromSheetWithMeta の Next データキャッシュ (tag: "invoices-sheet")
// を無効化する。これを叩いた直後に router.refresh() すると、キャッシュを介さず
// GAS から最新のシートを取り直す。
//
// このエンドポイント自体は GAS を叩かないので数ミリ秒で返る。
export async function POST() {
  revalidateTag("invoices-sheet");
  return NextResponse.json({ ok: true });
}
