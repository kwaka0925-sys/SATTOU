"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const STORAGE_KEY = "sattou-login-manager";
const SEEDED_FLAG_KEY = "sattou-login-manager-seeded";

type LoginEntry = {
  id: string;
  serviceName: string;
  loginUrl: string;
  loginId: string;
  password: string;
  note: string;
  createdAt: string;
};

const INITIAL_SEED: Omit<LoginEntry, "id" | "createdAt">[] = [
  {
    serviceName: "NSS（口座振替システム）",
    loginUrl: "https://www.nss-jp.com/login",
    loginId: "P0958414",
    password: "Sattou0601",
    note: "",
  },
  {
    serviceName: "gmail",
    loginUrl: "gmail",
    loginId: "Sattou.402@gmail.com",
    password: "Sattou_402_0601",
    note: "Sattou.402@gmail.com に二段階認証が届きます",
  },
  {
    serviceName: "gmail",
    loginUrl: "gmail",
    loginId: "sattouinc@gmail.com",
    password: "sattou0601",
    note: "",
  },
  {
    serviceName: "gmail",
    loginUrl: "gmail",
    loginId: "sattoueigyo@gmail.com",
    password: "sattou0601",
    note: "",
  },
  {
    serviceName: "請求書PDF用SATTOUアカウント",
    loginUrl: "gmail",
    loginId: "sattou@sattou.jp",
    password: "sattou0601",
    note: "",
  },
  {
    serviceName: "リモートデスクトップアカウント",
    loginUrl: "gmail",
    loginId: "sattou.reserve@gmail.com",
    password: "SmGf5tD3",
    note: "",
  },
  {
    serviceName: "三井住友銀行",
    loginUrl: "https://valuedoor.smbc.co.jp/login",
    loginId: "",
    password: "",
    note: "",
  },
  {
    serviceName: "Air work 採用",
    loginUrl: "https://ats.joboplite.jp/login_selection",
    loginId: "sattou.magome@gmail.com",
    password: "#Sattou0601",
    note: "",
  },
];

function newId(): string {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// URLらしい文字列かどうかを判定 (http://... または https://...)
function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}

// ログインURL欄に "gmail" と入っていたら Gmail のログイン画面へ誘導
function resolveUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (isHttpUrl(s)) return s;
  if (s.toLowerCase() === "gmail") return "https://accounts.google.com/signin";
  return null;
}

type LoginManagerViewProps = {
  locker?: React.ReactNode;
};

export default function LoginManagerView({ locker }: LoginManagerViewProps = {}) {
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [q, setQ] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          return;
        }
      }
      // 初回訪問時のみサンプルデータを投入。以後は空 → 空のまま維持
      if (!window.localStorage.getItem(SEEDED_FLAG_KEY)) {
        const now = new Date().toISOString();
        const seeded = INITIAL_SEED.map((e) => ({
          ...e,
          id: newId(),
          createdAt: now,
        }));
        setEntries(seeded);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        window.localStorage.setItem(SEEDED_FLAG_KEY, "1");
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: LoginEntry[]) => {
    setEntries(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const resetForm = () => {
    setServiceName("");
    setLoginUrl("");
    setLoginId("");
    setPassword("");
    setNote("");
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (e: LoginEntry) => {
    setServiceName(e.serviceName);
    setLoginUrl(e.loginUrl);
    setLoginId(e.loginId);
    setPassword(e.password);
    setNote(e.note);
    setEditingId(e.id);
    setShowForm(true);
  };

  const save = () => {
    const name = serviceName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const existing = editingId
      ? entries.find((e) => e.id === editingId)
      : undefined;
    const record: LoginEntry = {
      id: editingId ?? newId(),
      serviceName: name,
      loginUrl: loginUrl.trim(),
      loginId: loginId.trim(),
      password: password,
      note: note.trim(),
      createdAt: existing?.createdAt ?? now,
    };
    const next = editingId
      ? entries.map((e) => (e.id === editingId ? record : e))
      : [record, ...entries];
    persist(next);
    resetForm();
  };

  const deleteEntry = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("このログイン情報を削除しますか？")
    ) {
      return;
    }
    persist(entries.filter((e) => e.id !== id));
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard 権限が無い環境では静かに失敗
    }
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return entries;
    return entries.filter((e) => {
      const hay = `${e.serviceName} ${e.loginId} ${e.note}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [entries, q]);

  return (
    <div>
      <TopBar
        title="ログイン管理"
        subtitle={`登録済み ${entries.length} 件 · 表示 ${filtered.length} 件`}
      />
      <div className="p-6 space-y-4">
        {/* 注意書き */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
          <div className="font-medium mb-1">セキュリティに関する注意</div>
          <div className="leading-relaxed">
            登録内容はこのブラウザの localStorage
            のみに保存されます（サーバーには送信されません）。共有PCや不特定多数がアクセスできる端末での利用はお控えください。
          </div>
        </div>

        {/* 検索 + 追加 */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サービス名 / ID / メモで検索"
              className="input pl-9"
            />
          </div>
          <button
            onClick={startAdd}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>
          {locker}
        </div>

        {/* 追加 / 編集フォーム */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand-600" />
                {editingId ? "ログイン情報を編集" : "新規ログイン情報を登録"}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-700 block">
                  サービス名 <span className="text-rose-500">*</span>
                </label>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="例: NSS（口座振替システム）"
                  className="input"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-700 block">
                  ログインURL
                </label>
                <input
                  value={loginUrl}
                  onChange={(e) => setLoginUrl(e.target.value)}
                  placeholder="https://... または「gmail」（Google 認証の場合）"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">ID</label>
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="例: sattou@sattou.jp"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  パスワード
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード"
                  className="input font-mono"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-700 block">メモ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="二段階認証の宛先や共有ルールなど（任意）"
                  className="input min-h-[70px]"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="btn-ghost">
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={!serviceName.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* テーブル */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3 min-w-[200px]">
                    サービス名
                  </th>
                  <th className="text-left font-medium px-4 py-3">
                    ログインURL
                  </th>
                  <th className="text-left font-medium px-4 py-3">ID</th>
                  <th className="text-left font-medium px-4 py-3">
                    パスワード
                  </th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {entries.length === 0
                        ? "ログイン情報がまだありません。「新規追加」から追加してください。"
                        : "該当するログイン情報が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filtered.map((e) => {
                  const resolvedUrl = resolveUrl(e.loginUrl);
                  const isRevealed = revealed.has(e.id);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        {e.serviceName}
                      </td>
                      <td className="px-4 py-3">
                        {resolvedUrl ? (
                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs max-w-[240px] truncate"
                            title={e.loginUrl}
                          >
                            {e.loginUrl}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : e.loginUrl ? (
                          <span className="text-xs text-slate-500">
                            {e.loginUrl}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {e.loginId ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs break-all">
                              {e.loginId}
                            </span>
                            <button
                              onClick={() => copyText(e.loginId)}
                              className="text-slate-400 hover:text-brand-700 shrink-0"
                              title="IDをコピー"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {e.password ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs break-all">
                              {isRevealed ? e.password : "••••••••"}
                            </span>
                            <button
                              onClick={() => toggleReveal(e.id)}
                              className="text-slate-400 hover:text-brand-700 shrink-0"
                              title={isRevealed ? "隠す" : "表示"}
                            >
                              {isRevealed ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyText(e.password)}
                              className="text-slate-400 hover:text-brand-700 shrink-0"
                              title="パスワードをコピー"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-slate-500 max-w-[240px]"
                        title={e.note}
                      >
                        {e.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEdit(e)}
                          className="text-brand-700 hover:underline text-xs mr-3"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> 削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
