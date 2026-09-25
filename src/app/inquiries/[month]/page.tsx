import { notFound } from "next/navigation";
import InquiryMonthView from "./InquiryMonthView";
import { isDisplayMonth } from "../lib";

// /inquiries/YYYY-MM の詳細ページ。URL 検証 + 期間範囲チェックのみ行い、
// 実データはクライアント側で localStorage から読み込む。
export default function InquiryMonthPage({
  params,
}: {
  params: { month: string };
}) {
  const match = /^(\d{4})-(\d{2})$/.exec(params.month);
  if (!match) return notFound();
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return notFound();
  // 表示範囲 (2026-05 〜 2027-04) 外は 404 (URL 直打ちの防御)
  if (!isDisplayMonth(params.month)) return notFound();
  return <InquiryMonthView year={year} month={month} />;
}
