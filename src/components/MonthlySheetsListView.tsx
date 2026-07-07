"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "./TopBar";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderCog,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  basePath: string; // 例: "/invoicing-sheet"
  storageKey: string; // 例: "sattou-invoicing-sheets"
  year: number;
  // PDF出力時のファイル名接頭辞 (月部分は自動で挿入される)
  // 例: "請求書" → "2026年7月請求書_[タブ名].pdf"
  pdfNamePrefix: string;
  // Drive フォルダ URL を保持する localStorage キー
  folderStorageKey: string;
};

type MonthlyUrls = Record<string, string>;

type BulkPdfState =
  | { status: "idle" }
  | { status: "confirm"; monthKey: string }
  | { status: "running"; monthKey: string }
  | {
      status: "success";
      monthKey: string;
      folderUrl: string;
      total: number;
      successCount: number;
      errorCount: number;
      results: Array<{
        tabName: string;
        fileName: string;
        fileUrl?: string;
        error?: string;
      }>;
    }
  | { status: "error"; monthKey: string; message: string };

export default function MonthlySheetsListView({
  title,
  subtitle,
  basePath,
  storageKey,
  year,
  pdfNamePrefix,
  folderStorageKey,
}: Props) {
  const [urls, setUrls] = useState<MonthlyUrls>({});
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [folderUrl, setFolderUrl] = useState<string>("");
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [folderSettingsValue, setFolderSettingsValue] = useState("");
  const [bulkPdf, setBulkPdf] = useState<BulkPdfState>({ status: "idle" });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") setUrls(parsed);
      }
      const savedFolder = window.localStorage.getItem(folderStorageKey);
      if (savedFolder) setFolderUrl(savedFolder);
    } catch {
      // ignore
    }
  }, [storageKey, folderStorageKey]);

  const persist = (next: MonthlyUrls) => {
    setUrls(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  };

  const persistFolder = (url: string) => {
    setFolderUrl(url);
    try {
      if (url) window.localStorage.setItem(folderStorageKey, url);
      else window.localStorage.removeItem(folderStorageKey);
    } catch {
      // ignore quota
    }
  };

  const startEdit = (month: string) => {
    setEditingMonth(month);
    setEditValue(urls[month] ?? "");
  };

  const saveEdit = () => {
    if (!editingMonth) return;
    const url = editValue.trim();
    const next = { ...urls };
    if (url) next[editingMonth] = url;
    else delete next[editingMonth];
    persist(next);
    setEditingMonth(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingMonth(null);
    setEditValue("");
  };

  const deleteMonth = (month: string) => {
    const monthNum = parseInt(month.split("-")[1], 10);
    if (!window.confirm(`${monthNum}月の URL を削除しますか？`)) return;
    const next = { ...urls };
    delete next[month];
    persist(next);
  };

  const openFolderSettings = () => {
    setFolderSettingsValue(folderUrl);
    setShowFolderSettings(true);
  };

  const saveFolderSettings = () => {
    persistFolder(folderSettingsValue.trim());
    setShowFolderSettings(false);
  };

  const runBulkPdf = async (monthKey: string) => {
    const sheetUrl = urls[monthKey];
    if (!sheetUrl) return;
    if (!folderUrl) {
      alert(
        "保存先の Drive フォルダが未設定です。右上「PDF設定」から登録してください。",
      );
      return;
    }
    const [y, m] = monthKey.split("-");
    const monthLabel = `${y}年${parseInt(m, 10)}月`;
    const fileNamePrefix = `${monthLabel}${pdfNamePrefix}`;
    // サブフォルダ名: "2026年7月SATTOU請求書" / "2026年7月SATTOU口座振替"
    const subfolderName = `${monthLabel}SATTOU${pdfNamePrefix}`;

    setBulkPdf({ status: "running", monthKey });
    try {
      const res = await fetch("/api/bulk-pdf-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl,
          folderUrl,
          fileNamePrefix,
          subfolderName,
          excludeHidden: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setBulkPdf({
          status: "error",
          monthKey,
          message: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setBulkPdf({
        status: "success",
        monthKey,
        folderUrl: data.folderUrl,
        total: data.total ?? 0,
        successCount: data.successCount ?? 0,
        errorCount: data.errorCount ?? 0,
        results: data.results ?? [],
      });
    } catch (err) {
      setBulkPdf({
        status: "error",
        monthKey,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const key = `${year}-${String(m).padStart(2, "0")}`;
      return { m, key, url: urls[key] };
    });
  }, [year, urls]);

  const registeredCount = months.filter((m) => m.url).length;
  const folderConfigured = !!folderUrl;

  const closeBulkPdf = () => setBulkPdf({ status: "idle" });

  return (
    <div>
      <TopBar
        title={title}
        subtitle={`${year}年 · ${subtitle} · 登録済み ${registeredCount} / 12 月`}
      />
      <div className="p-6 space-y-4">
        {/* PDF出力の設定状況 */}
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <FolderCog className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600">PDF出力先フォルダ:</span>
            {folderConfigured ? (
              <a
                href={folderUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-700 hover:underline text-xs inline-flex items-center gap-1 truncate max-w-[280px]"
                title={folderUrl}
              >
                {folderUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="text-xs text-amber-700">未設定</span>
            )}
          </div>
          <button
            onClick={openFolderSettings}
            className="btn-ghost text-xs inline-flex items-center gap-1 ml-auto"
          >
            <FolderCog className="w-3 h-3" />
            PDF設定
          </button>
        </div>

        {/* 年切替 */}
        <div className="card p-3 flex items-center justify-center gap-4">
          <Link
            href={`${basePath}?year=${year - 1}`}
            className="btn-ghost text-sm inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {year - 1}年
          </Link>
          <div className="font-semibold text-lg">{year}年</div>
          <Link
            href={`${basePath}?year=${year + 1}`}
            className="btn-ghost text-sm inline-flex items-center gap-1"
          >
            {year + 1}年 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 12ヶ月タイル */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {months.map((m) => (
            <div key={m.key} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg">{m.m}月</div>
                {m.url ? (
                  <span className="pill bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 text-[10px]">
                    登録済
                  </span>
                ) : (
                  <span className="pill bg-slate-100 text-slate-500 ring-1 ring-slate-200 text-[10px]">
                    未登録
                  </span>
                )}
              </div>
              {m.url ? (
                <>
                  <div
                    className="text-[10px] text-slate-400 font-mono truncate"
                    title={m.url}
                  >
                    {m.url}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Link
                      href={`${basePath}/${m.key}`}
                      className="btn-primary text-xs inline-flex items-center gap-1 flex-1 justify-center"
                    >
                      開く <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => startEdit(m.key)}
                      className="text-slate-500 hover:text-brand-700 p-1.5 rounded-md hover:bg-slate-100"
                      title="URLを編集"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMonth(m.key)}
                      className="text-slate-500 hover:text-rose-600 p-1.5 rounded-md hover:bg-slate-100"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      setBulkPdf({ status: "confirm", monthKey: m.key })
                    }
                    disabled={!folderConfigured}
                    className="btn-ghost text-xs inline-flex items-center gap-1 justify-center border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      folderConfigured
                        ? "全タブを PDF 化して Drive フォルダに保存"
                        : "PDF出力先フォルダを設定してください"
                    }
                  >
                    <FileText className="w-3 h-3" />
                    一括PDF出力
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-400 flex-1 flex items-center">
                    URLが未登録
                  </div>
                  <button
                    onClick={() => startEdit(m.key)}
                    className="btn-primary text-xs mt-2 inline-flex items-center gap-1 justify-center"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> URL登録
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* URL 編集ダイアログ */}
      {editingMonth && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={cancelEdit}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg">
              {parseInt(editingMonth.split("-")[1], 10)}月のスプレッドシートURL
            </h3>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="input w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={cancelEdit} className="btn-ghost">
                キャンセル
              </button>
              <button onClick={saveEdit} className="btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF出力先フォルダ設定ダイアログ */}
      {showFolderSettings && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={() => setShowFolderSettings(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FolderCog className="w-5 h-5 text-brand-600" />
              PDF出力先フォルダの設定
            </h3>
            <div className="space-y-1">
              <label className="text-sm text-slate-700 block">
                Google Drive フォルダ URL
              </label>
              <input
                value={folderSettingsValue}
                onChange={(e) => setFolderSettingsValue(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="input w-full"
                autoFocus
              />
              <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Drive でフォルダを開いて URL をコピー、または右クリック「共有可能なリンクを取得」で取得できます。sattou を運用する Google アカウントに編集権限が必要です。
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFolderSettings(false)}
                className="btn-ghost"
              >
                キャンセル
              </button>
              <button onClick={saveFolderSettings} className="btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一括PDF確認ダイアログ */}
      {bulkPdf.status === "confirm" && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={closeBulkPdf}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              一括PDF出力の実行
            </h3>
            <div className="text-sm text-slate-700 space-y-2">
              <div>
                <span className="text-slate-500">対象月: </span>
                <strong>
                  {parseInt(bulkPdf.monthKey.split("-")[1], 10)}月
                </strong>
              </div>
              <div>
                <span className="text-slate-500">ファイル名: </span>
                <span className="font-mono text-xs">
                  {`${bulkPdf.monthKey.split("-")[0]}年${parseInt(bulkPdf.monthKey.split("-")[1], 10)}月${pdfNamePrefix}_[タブ名].pdf`}
                </span>
              </div>
              <div>
                <span className="text-slate-500">サブフォルダ: </span>
                <span className="font-mono text-xs">
                  {`${bulkPdf.monthKey.split("-")[0]}年${parseInt(bulkPdf.monthKey.split("-")[1], 10)}月SATTOU${pdfNamePrefix}`}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  (親フォルダ内に自動作成)
                </span>
              </div>
              <div>
                <span className="text-slate-500">保存先: </span>
                <a
                  href={folderUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-brand-700 hover:underline text-xs"
                >
                  設定済み親フォルダを開く
                </a>
              </div>
              <div className="text-xs text-slate-500 leading-relaxed">
                対象スプレッドシートの全タブ（非表示タブを除く）をPDF化し、上のフォルダに保存します。50社程度で約30〜60秒かかります。
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeBulkPdf} className="btn-ghost">
                キャンセル
              </button>
              <button
                onClick={() => runBulkPdf(bulkPdf.monthKey)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                出力開始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 実行中 */}
      {bulkPdf.status === "running" && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full space-y-4 shadow-xl text-center">
            <Loader2 className="w-10 h-10 text-brand-600 mx-auto animate-spin" />
            <h3 className="font-semibold text-lg">
              PDFを出力中...
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {parseInt(bulkPdf.monthKey.split("-")[1], 10)}月分のスプレッドシートを PDF に変換して Drive に保存しています。
              50社で約30〜60秒、140社で1〜3分かかります。この画面を閉じずにお待ちください。
            </p>
          </div>
        </div>
      )}

      {/* 成功 */}
      {bulkPdf.status === "success" && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={closeBulkPdf}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                PDF出力が完了しました
              </h3>
              <button
                onClick={closeBulkPdf}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center bg-slate-50">
                <div className="text-xs text-slate-500">対象</div>
                <div className="text-xl font-semibold">
                  {bulkPdf.total}
                </div>
              </div>
              <div className="card p-3 text-center bg-emerald-50">
                <div className="text-xs text-emerald-700">成功</div>
                <div className="text-xl font-semibold text-emerald-800">
                  {bulkPdf.successCount}
                </div>
              </div>
              <div className="card p-3 text-center bg-rose-50">
                <div className="text-xs text-rose-700">エラー</div>
                <div className="text-xl font-semibold text-rose-800">
                  {bulkPdf.errorCount}
                </div>
              </div>
            </div>
            {bulkPdf.errorCount > 0 && (
              <details className="text-xs text-rose-800 bg-rose-50 rounded-md p-3">
                <summary className="cursor-pointer font-medium">
                  エラー詳細（{bulkPdf.errorCount} 件）
                </summary>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  {bulkPdf.results
                    .filter((r) => r.error)
                    .slice(0, 10)
                    .map((r, i) => (
                      <li key={i}>
                        <span className="font-mono">{r.tabName}</span>: {r.error}
                      </li>
                    ))}
                </ul>
              </details>
            )}
            <a
              href={bulkPdf.folderUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary inline-flex items-center gap-2 w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              Drive フォルダを開く
            </a>
          </div>
        </div>
      )}

      {/* エラー */}
      {bulkPdf.status === "error" && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={closeBulkPdf}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
                PDF出力に失敗しました
              </h3>
              <button
                onClick={closeBulkPdf}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-rose-800 bg-rose-50 rounded-md p-3 leading-relaxed">
              {bulkPdf.message}
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              考えられる原因:
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>Vercel の環境変数 SHEETS_GAS_URL_BULK_PDF / SHEETS_GAS_TOKEN_BULK_PDF が未設定</li>
                <li>GAS Web App が未デプロイ、または URL/TOKEN が違う</li>
                <li>PDF出力先フォルダに書き込み権限がない</li>
                <li>スプレッドシートに閲覧権限がない</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
