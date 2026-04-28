import { NextRequest, NextResponse } from "next/server";
import { fetchInvoicesFromSheet, currentMonth } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? currentMonth();
  const invoices = await fetchInvoicesFromSheet(month);
  return NextResponse.json({
    month,
    count: invoices.length,
    invoices,
    configured: Boolean(process.env.SHEETS_GAS_URL && process.env.SHEETS_GAS_TOKEN),
  });
}
