"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmbeddedSheetView from "./EmbeddedSheetView";
import TopBar from "./TopBar";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

type Props = {
  title: string;
  basePath: string; // 例: "/invoicing-sheet"
  storageKey: string; // 例: "sattou-invoicing-sheets"
  month: string; // "YYYY-MM"
};

export default function MonthlySheetEmbedView({
  title,
  basePath,
  storageKey,
  month,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed[month] === "string"
        ) {
          setUrl(parsed[month]);
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [storageKey, month]);

  const [y, m] = month.split("-");
  const monthLabel = `${y}年${parseInt(m, 10)}月`;

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">読み込み中...</div>
    );
  }

  if (!url) {
    return (
      <div>
        <TopBar
          title={`${title} - ${monthLabel}`}
          subtitle="スプレッドシートが未登録"
        />
        <div className="p-6 space-y-4">
          <Link
            href={basePath}
            className="btn-ghost inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> 月別一覧に戻る
          </Link>
          <div className="card p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h2 className="font-semibold text-lg mb-2">
              {monthLabel} のスプレッドシートが登録されていません
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              一覧画面から {parseInt(m, 10)}月の URL を登録してください。
            </p>
            <Link href={basePath} className="btn-primary">
              一覧に戻ってURL登録
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmbeddedSheetView
      title={`${title} - ${monthLabel}`}
      subtitle={`${monthLabel} のスプレッドシート`}
      editUrl={url}
      backHref={basePath}
      backLabel="月別一覧に戻る"
    />
  );
}
