"use client";

import { useState } from "react";
import Link from "next/link";
import TopBar from "./TopBar";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  editUrl: string;
  backHref?: string;
  backLabel?: string;
};

// URL に埋め込みを許可するパラメータを付与。
// - rm=embedded : ツールバーを隠しつつ編集可能な埋め込みモード
// - widget=true : グラフガジェット用のクリーンな枠なし表示
// どちらも Google 側で iframe 埋め込みを許可する組み合わせ。
function toEmbedUrl(editUrl: string): string {
  try {
    const u = new URL(editUrl);
    u.searchParams.set("rm", "embedded");
    u.searchParams.set("widget", "true");
    u.searchParams.set("headers", "false");
    return u.toString();
  } catch {
    return editUrl;
  }
}

// スプレッドシートIDを抽出し、直接PDFエクスポートするURLに変換。
// 埋め込みモードではファイルメニューが動かないため、
// PDF出力だけは export エンドポイント経由で1クリックで実行できるようにする。
function toPdfExportUrl(editUrl: string): string | null {
  try {
    const u = new URL(editUrl);
    // https://docs.google.com/spreadsheets/d/<ID>/edit?...
    const match = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) return null;
    const id = match[1];
    // 現在のタブ (gid) を維持
    const gid =
      u.searchParams.get("gid") ??
      u.hash.match(/gid=(\d+)/)?.[1] ??
      null;
    const exportUrl = new URL(
      `https://docs.google.com/spreadsheets/d/${id}/export`,
    );
    exportUrl.searchParams.set("format", "pdf");
    if (gid) exportUrl.searchParams.set("gid", gid);
    return exportUrl.toString();
  } catch {
    return null;
  }
}

export default function EmbeddedSheetView({
  title,
  subtitle,
  editUrl,
  backHref,
  backLabel,
}: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const embedUrl = toEmbedUrl(editUrl);
  const pdfUrl = toPdfExportUrl(editUrl);

  return (
    <div className="h-screen flex flex-col">
      <TopBar title={title} subtitle={subtitle} />
      <div className="shrink-0 px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="text-xs text-brand-700 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              {backLabel ?? "戻る"}
            </Link>
          )}
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            埋め込みではメニュー操作（ファイル・PDF出力等）は制限されます。フル機能は「新しいタブで開く」から。
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="btn-ghost inline-flex items-center gap-2 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            再読み込み
          </button>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost inline-flex items-center gap-2 text-xs"
              title="現在のタブをPDFとしてダウンロード"
            >
              <Download className="w-3 h-3" />
              PDF出力
            </a>
          )}
          <a
            href={editUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary inline-flex items-center gap-2 text-xs"
          >
            新しいタブで開く
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-slate-100">
        <iframe
          key={iframeKey}
          src={embedUrl}
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          title={title}
        />
      </div>
    </div>
  );
}
