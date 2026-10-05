"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Megaphone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const STORAGE_KEY = "sattou-admin-sheets";
const SEEDED_FLAG_KEY = "sattou-admin-sheets-seeded";

type AdminSheet = {
  id: string;
  title: string;
  url: string;
  note: string;
  createdAt: string;
};

const INITIAL_SEED: Omit<AdminSheet, "id" | "createdAt">[] = [
  {
    title: "新SATTOU ログイン情報",
    url: "https://docs.google.com/spreadsheets/d/14H1BAMQp9yxGR_VIaP3aMx0hJca68v2SwYaqqPD5UXY/edit?gid=0#gid=0",
    note: "",
  },
  {
    title: "旧SATTOU ログイン情報",
    url: "https://docs.google.com/spreadsheets/d/1f7SyxfXRBL_ooxkziswyBkIE1M8ZvVuExzgCAPhPWmY/edit?gid=0#gid=0",
    note: "",
  },
  {
    title: "口座振替情報",
    url: "https://docs.google.com/spreadsheets/d/1iLeobLRP39Nhx1aW6f9loZv_Rf-gJFqd9qpspfe7934/edit?resourcekey=&gid=1828469819#gid=1828469819",
    note: "",
  },
  {
    title: "システム構築 初期記入シートテンプレ（コピーしたものを共有）",
    url: "https://docs.google.com/spreadsheets/d/1mbG3THPSzTV5UMHYS2BavQ08y11dEkLZ9I0js69LWLw/edit?gid=795953631#gid=795953631",
    note: "",
  },
  {
    title: "當銘先生広告CR依頼シート",
    url: "https://docs.google.com/spreadsheets/d/10a4ypH3ox4AOIMiWrm3MtL-OA7fl9Wi5QI6tCGzGTPQ/edit?gid=2079192149#gid=2079192149",
    note: "",
  },
  {
    title: "請求書関係のシート",
    url: "https://docs.google.com/spreadsheets/d/1W8aMDGLyv1XbdY7lemRR8JfVrSN9L44nLi-KtNRHrc70/edit?gid=352138221#gid=352138221",
    note: "",
  },
  {
    title: "サロンボード連携情報",
    url: "https://docs.google.com/spreadsheets/d/1gWS9xeQHQqMZACgSkP9qYzVsGuLVz7UCKmsoXFw03ek/edit?gid=1076817151#gid=1076817151",
    note: "",
  },
  {
    title: "サロンボード連携注意事項（クライアント共有用）",
    url: "https://docs.google.com/document/d/1GQJnC1juVojxqdqamH3EUWLQHfv-9UhbXAK3W366Ouo/edit?tab=t.j9jnjhdcyuhv#heading=h.l0cky53e6tdj",
    note: "",
  },
  {
    title: "新SATTOUマニュアル（クライアント共有用）",
    url: "https://docs.google.com/document/d/1QtAJmpp9hyJf7upumLve8tDtluEPvppde6TBP_IALuQ/edit?tab=t.zdgefobc2ne2#heading=h.ph519pb5pvvj",
    note: "",
  },
  {
    title: "契約時、システム納品時のクライアント共有テンプレ",
    url: "https://docs.google.com/document/d/1czJHTkjYuaAhd8loH9T6MZdClHdNP6SPgrH1z4MqUHA/edit?tab=t.2a5ehirzuehj",
    note: "",
  },
  {
    title: "SATTOU PPC広告",
    url: "https://ads.google.com/aw/keywords/searchterms?campaignId=23475658706&ocid=7943351698&workspaceId=0&src=ads_oneBox&__u=6012201427&__c=1449481602&authuser=0&subid=ww-ww-xs-ip_OB_Fix_campaign",
    note: "",
  },
];

function newId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// URL からドキュメント種別を推定し、アイコンとバッジ色に反映する
function typeOf(url: string): "spreadsheet" | "document" | "ads" | "other" {
  const s = url.toLowerCase();
  if (s.includes("spreadsheets/d/")) return "spreadsheet";
  if (s.includes("document/d/")) return "document";
  if (s.includes("ads.google.com")) return "ads";
  return "other";
}

const TYPE_META: Record<
  ReturnType<typeof typeOf>,
  { label: string; badge: string; Icon: typeof FileSpreadsheet }
> = {
  spreadsheet: {
    label: "スプレッドシート",
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    Icon: FileSpreadsheet,
  },
  document: {
    label: "ドキュメント",
    badge: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
    Icon: FileText,
  },
  ads: {
    label: "Google Ads",
    badge: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    Icon: Megaphone,
  },
  other: {
    label: "その他",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    Icon: FileText,
  },
};

// URLらしくない入力（"gmail" 等）はリンクにしない
function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

export default function AdminSheetsView() {
  const [entries, setEntries] = useState<AdminSheet[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
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

  const persist = (next: AdminSheet[]) => {
    setEntries(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setNote("");
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (e: AdminSheet) => {
    setTitle(e.title);
    setUrl(e.url);
    setNote(e.note);
    setEditingId(e.id);
    setShowForm(true);
  };

  const save = () => {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    const now = new Date().toISOString();
    const existing = editingId
      ? entries.find((e) => e.id === editingId)
      : undefined;
    const record: AdminSheet = {
      id: editingId ?? newId(),
      title: t,
      url: u,
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
      !window.confirm("この管理系シートを削除しますか？")
    ) {
      return;
    }
    persist(entries.filter((e) => e.id !== id));
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return entries;
    return entries.filter((e) => {
      const hay = `${e.title} ${e.note}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [entries, q]);

  return (
    <div>
      <TopBar
        title="管理系シート"
        subtitle={`登録済み ${entries.length} 件 · 表示 ${filtered.length} 件`}
      />
      <div className="p-6 space-y-4">
        {/* 検索 + 追加 */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="シート名 / メモで検索"
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
        </div>

        {/* 追加 / 編集フォーム */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                {editingId
                  ? "管理系シートを編集"
                  : "新しい管理系シートを追加"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  シート名 <span className="text-rose-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 請求書関係のシート"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  URL <span className="text-rose-500">*</span>
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/..."
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">メモ</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="共有範囲や利用シーンなど（任意）"
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
                disabled={!title.trim() || !url.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* カードグリッド (URL全文がテーブルだと横に伸びるのでカードで整理) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="card p-6 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              {entries.length === 0
                ? "管理系シートがまだありません。「新規追加」から追加してください。"
                : "該当する管理系シートが見つかりませんでした。"}
            </div>
          )}
          {filtered.map((e) => {
            const t = typeOf(e.url);
            const meta = TYPE_META[t];
            const Icon = meta.Icon;
            const openUrl = normalizeUrl(e.url);
            return (
              <div
                key={e.id}
                className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm break-words">
                        {e.title}
                      </div>
                      <span className={`pill mt-1 ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                </div>
                {e.note && (
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {e.note}
                  </div>
                )}
                <div
                  className="text-[11px] text-slate-400 font-mono truncate"
                  title={e.url}
                >
                  {e.url}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                  {openUrl ? (
                    <a
                      href={openUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-md bg-brand-50 hover:bg-brand-100 px-2.5 py-1 text-brand-700 text-xs font-medium"
                    >
                      開く <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">
                      URLが不正です
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEdit(e)}
                      className="text-brand-700 hover:underline text-xs"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> 削除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
