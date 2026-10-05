import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 別ユーザーが編集した最新値を取り込みたい時に叩く軽量エンドポイント。
// クライアントがフォーカス復帰時や「更新」ボタンで呼ぶことで、
// 次の SSR フェッチが確実に GAS を叩き直す。
export async function POST() {
  revalidateTag("migrations-sheet");
  return NextResponse.json({ ok: true });
}
