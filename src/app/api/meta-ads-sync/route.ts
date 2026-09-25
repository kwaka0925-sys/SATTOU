import { NextRequest, NextResponse } from "next/server";
import { fetchInvoicesFromSheet, currentMonth } from "@/lib/sheets";
import {
  extractAdAccountIdFromUrl,
  fetchSpendForAccounts,
} from "@/lib/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const month = searchParams.get("month") ?? currentMonth();

  if (!since || !until) {
    return NextResponse.json(
      {
        error: "Query params 'since' and 'until' are required (YYYY-MM-DD).",
      },
      { status: 400 },
    );
  }

  // 日付形式の簡易バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return NextResponse.json(
      { error: "since/until must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "META_ADS_ACCESS_TOKEN is not configured. Add it to Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  // 対象月の請求書シートを読み込み、各行の otherAdSpendUrl を確認
  const rows = await fetchInvoicesFromSheet(month);

  const adAccounts = rows
    .map((r) => {
      const adAccountId = extractAdAccountIdFromUrl(r.otherAdSpendUrl ?? "");
      return {
        clientKey: r.id,
        clientName: r.clientName,
        subscriberId: r.subscriberId,
        adAccountId,
        rawUrl: r.otherAdSpendUrl ?? "",
      };
    })
    .filter(
      (a): a is typeof a & { adAccountId: string } => a.adAccountId !== null,
    );

  if (adAccounts.length === 0) {
    return NextResponse.json({
      since,
      until,
      month,
      total: 0,
      matched: 0,
      results: [],
      message:
        "対象月の請求書シートに Meta 広告マネージャの URL が見つかりませんでした。",
    });
  }

  const spendMap = await fetchSpendForAccounts(
    adAccounts.map((a) => ({
      adAccountId: a.adAccountId,
      clientKey: a.clientKey,
    })),
    since,
    until,
    accessToken,
  );

  const results = adAccounts.map((a) => {
    const spend = spendMap.get(a.clientKey);
    return {
      clientKey: a.clientKey,
      clientName: a.clientName,
      subscriberId: a.subscriberId ?? null,
      adAccountId: a.adAccountId,
      spend: spend?.spend ?? 0,
      currency: spend?.currency,
      error: spend?.error,
    };
  });

  const totalSpend = results.reduce((s, r) => s + r.spend, 0);
  const errorCount = results.filter((r) => r.error).length;

  return NextResponse.json({
    since,
    until,
    month,
    total: rows.length,
    matched: adAccounts.length,
    totalSpend,
    errorCount,
    results,
  });
}
