import { notFound } from "next/navigation";
import ShareholderMonthView from "./ShareholderMonthView";

// /shareholder-invoices/YYYY-MM の詳細ページ。URL の月キーだけ受け取り、
// 実データはクライアント側で localStorage から読み込む。
export default function ShareholderMonthPage({
  params,
}: {
  params: { month: string };
}) {
  // "YYYY-MM" の形式チェック。ぱらめの誤入力や古いブックマークで来た場合の防衛。
  const match = /^(\d{4})-(\d{2})$/.exec(params.month);
  if (!match) return notFound();
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return notFound();
  return <ShareholderMonthView year={year} month={month} />;
}
