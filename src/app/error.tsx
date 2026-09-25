"use client";

// アプリ全体のエラーバウンダリ。サーバー/クライアントで捕捉されなかった
// 例外が投げられた場合、ここで受け止めて白紙の代わりに再読み込み UI を出す。
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full card p-6 space-y-4">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-lg font-semibold">エラーが発生しました</h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          ページの読み込み中に予期しないエラーが発生しました。もう一度お試しください。問題が続く場合は、少し時間をおいてから再度アクセスしてください。
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono">
            エラーID: {error.digest}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            もう一度試す
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-ghost"
          >
            ページを再読み込み
          </button>
        </div>
      </div>
    </div>
  );
}
