import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 別ユーザーが追加/編集/削除した最新値を取り込みたい時に叩く軽量エンドポイント。
export async function POST() {
  revalidateTag("cancellations-manual");
  return NextResponse.json({ ok: true });
}
