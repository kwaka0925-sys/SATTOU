"use client";

import { useEffect, useState } from "react";
import { Lock, LockOpen, ShieldAlert } from "lucide-react";

const AUTH_KEY = "sattou-login-manager-auth-v1";
// クライアント側の簡易ゲート。バンドルに残るため強固ではないが、
// 通りすがりの覗き見を防ぐ用途としては有効。
const CORRECT_PASSWORD = "sattou0410";

type Props = {
  children: (locker: React.ReactNode) => React.ReactNode;
};

export default function LoginGate({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">(
    "loading",
  );
  const [input, setInput] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem(AUTH_KEY) === "1" ||
        window.sessionStorage.getItem(AUTH_KEY) === "1"
      ) {
        setStatus("unlocked");
        return;
      }
    } catch {
      // ignore
    }
    setStatus("locked");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      try {
        if (remember) {
          window.localStorage.setItem(AUTH_KEY, "1");
          window.sessionStorage.removeItem(AUTH_KEY);
        } else {
          window.sessionStorage.setItem(AUTH_KEY, "1");
          window.localStorage.removeItem(AUTH_KEY);
        }
      } catch {
        // ignore quota
      }
      setInput("");
      setError("");
      setStatus("unlocked");
      return;
    }
    setError("パスワードが違います");
  };

  const lock = () => {
    try {
      window.localStorage.removeItem(AUTH_KEY);
      window.sessionStorage.removeItem(AUTH_KEY);
    } catch {
      // ignore
    }
    setStatus("locked");
  };

  if (status === "loading") {
    return null;
  }

  if (status === "locked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full card p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">ログイン管理</h1>
              <p className="text-xs text-slate-500">
                口座情報を含むため、閲覧にはパスワードが必要です
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-slate-700 block">
                パスワード
              </label>
              <input
                type="password"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (error) setError("");
                }}
                className="input"
                autoFocus
                autoComplete="current-password"
                name="sattou-login-manager-password"
              />
            </div>
            {error && (
              <div className="text-xs text-rose-600">{error}</div>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              このブラウザで記憶する（次回から入力を省略）
            </label>
            <button type="submit" className="btn-primary w-full">
              閲覧する
            </button>
          </form>

          <div className="flex items-start gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <div className="leading-relaxed">
              このパスワード保護はブラウザ内の簡易ロックです。共有PCでは
              「このブラウザで記憶する」のチェックを外すことを推奨します。
              技術的に強固な保護には別途サーバー側認証が必要です。
            </div>
          </div>
        </div>
      </div>
    );
  }

  const locker = (
    <button
      onClick={lock}
      className="btn-ghost inline-flex items-center gap-1 text-xs"
      title="このブラウザから記憶を消去してロック"
    >
      <LockOpen className="w-3 h-3" />
      ロック
    </button>
  );

  return <>{children(locker)}</>;
}
