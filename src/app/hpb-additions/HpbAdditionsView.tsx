"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import { ChevronDown, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { num } from "@/lib/format";

const STORAGE_KEY = "sattou-hpb-additions";
// ブランド名候補を集める他ページの localStorage キー。
// これらに保存されている過去のブランド名を集約して、
// HPB 連携追加時のドロップダウン候補にする。
const STORE_ADDITIONS_KEY = "sattou-store-additions";
const NEW_REGISTRATIONS_KEY = "sattou-new-registrations";

type HpbAddition = {
  id: string;
  brand: string;
  store: string;
  installDate: string; // YYYY-MM-DD
  createdAt: string;
};

type Props = {
  year: number;
  // 請求書シートから引いてきたクライアント (店舗) 名の重複除去済みリスト。
  // 店舗名側のオートコンプリート候補として使う。
  salonNames?: string[];
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function newId(): string {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function yearMonths(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

// 指定 localStorage キーからブランド名を集める。存在しないキーや不正データは無視。
function collectBrandsFrom(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((r: { brand?: string }) => (r?.brand ?? "").trim())
      .filter((s: string) => s.length > 0);
  } catch {
    return [];
  }
}

export default function HpbAdditionsView({ year, salonNames = [] }: Props) {
  const [regs, setRegs] = useState<HpbAddition[]>([]);
  const [brandCandidates, setBrandCandidates] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [brand, setBrand] = useState("");
  const [store, setStore] = useState("");
  const [installDate, setInstallDate] = useState("");

  // ブランド名ドロップダウン (店舗追加/新規登録/HPB追加の過去エントリから集約)
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandHighlight, setBrandHighlight] = useState(0);
  const brandWrapRef = useRef<HTMLDivElement | null>(null);

  // 店舗名オートコンプリート (請求書シートからの候補)
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeHighlight, setStoreHighlight] = useState(0);
  const storeWrapRef = useRef<HTMLDivElement | null>(null);

  // 店舗名オートコンプリート候補: 空入力時は全件 (上限 30)、
  // それ以外は部分一致。
  const storeSuggestions = useMemo(() => {
    const qq = store.trim().toLowerCase();
    const all = salonNames;
    if (!qq) return all.slice(0, 30);
    return all.filter((n) => n.toLowerCase().includes(qq)).slice(0, 30);
  }, [salonNames, store]);

  // ブランド名候補: 過去 HPB エントリ + 店舗追加 + 新規登録 のブランド名を
  // 重複除去してあいうえお順にソート。
  const brandSuggestions = useMemo(() => {
    const qq = brand.trim().toLowerCase();
    const all = brandCandidates;
    if (!qq) return all.slice(0, 30);
    return all.filter((n) => n.toLowerCase().includes(qq)).slice(0, 30);
  }, [brandCandidates, brand]);

  // ポップオーバー外クリックで閉じる。ブランド用と店舗用でそれぞれ登録。
  useEffect(() => {
    if (!brandOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!brandWrapRef.current) return;
      if (!brandWrapRef.current.contains(e.target as Node)) {
        setBrandOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [brandOpen]);

  useEffect(() => {
    if (!storeOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!storeWrapRef.current) return;
      if (!storeWrapRef.current.contains(e.target as Node)) {
        setStoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [storeOpen]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRegs(parsed);
      }
    } catch {
      // ignore
    }
    // 他ページも含めてブランド名候補を集める。
    const fromHpb = collectBrandsFrom(STORAGE_KEY);
    const fromStores = collectBrandsFrom(STORE_ADDITIONS_KEY);
    const fromNew = collectBrandsFrom(NEW_REGISTRATIONS_KEY);
    const unique = Array.from(
      new Set([...fromHpb, ...fromStores, ...fromNew]),
    ).sort((a, b) => a.localeCompare(b, "ja"));
    setBrandCandidates(unique);
  }, []);

  const persist = (next: HpbAddition[]) => {
    setRegs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
    // 保存後にブランド候補も更新 (新規ブランド名が入った可能性)
    const newBrand = next
      .map((r) => r.brand.trim())
      .filter((s) => s.length > 0);
    setBrandCandidates((prev) =>
      Array.from(new Set([...prev, ...newBrand])).sort((a, b) =>
        a.localeCompare(b, "ja"),
      ),
    );
  };

  const resetForm = () => {
    setBrand("");
    setStore("");
    setInstallDate("");
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    const today = new Date().toISOString().slice(0, 10);
    setInstallDate(today);
    setShowForm(true);
  };

  const startEdit = (r: HpbAddition) => {
    setBrand(r.brand);
    setStore(r.store);
    setInstallDate(r.installDate);
    setEditingId(r.id);
    setShowForm(true);
  };

  const save = () => {
    // 店舗名は任意入力に変更。導入日だけ必須のガード。
    if (!installDate) return;
    const now = new Date().toISOString();
    const existing = editingId
      ? regs.find((r) => r.id === editingId)
      : undefined;
    const record: HpbAddition = {
      id: editingId ?? newId(),
      brand: brand.trim(),
      store: store.trim(),
      installDate,
      createdAt: existing?.createdAt ?? now,
    };
    const next = editingId
      ? regs.map((r) => (r.id === editingId ? record : r))
      : [record, ...regs];
    persist(next);
    resetForm();
  };

  const deleteReg = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("このホットペッパー連携追加を削除しますか？")
    ) {
      return;
    }
    persist(regs.filter((r) => r.id !== id));
  };

  const months = useMemo(() => yearMonths(year), [year]);

  const countsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    regs.forEach((r) => {
      const month = r.installDate.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + 1);
    });
    return map;
  }, [regs]);

  const totalCount = regs.length;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthCount = countsByMonth.get(currentMonthKey) ?? 0;

  const filtered = useMemo(() => {
    return regs
      .filter((r) => {
        if (monthFilter !== "all" && r.installDate.slice(0, 7) !== monthFilter)
          return false;
        if (q) {
          const qq = q.toLowerCase();
          const hay = `${r.brand} ${r.store}`.toLowerCase();
          if (!hay.includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.installDate < b.installDate ? 1 : -1));
  }, [regs, monthFilter, q]);

  return (
    <div>
      <TopBar
        title="ホットペッパー連携追加"
        subtitle={`${year}年 · 累計 ${totalCount} 件 · 今月 ${thisMonthCount} 件`}
      />
      <div className="p-6 space-y-4">
        {/* Monthly summary tiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" /> 月別ホットペッパー連携追加数
            </h2>
            <div className="text-xs text-slate-500">導入日ベース</div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {months.map((month) => {
              const count = countsByMonth.get(month) ?? 0;
              const active = monthFilter === month;
              return (
                <button
                  key={month}
                  onClick={() =>
                    setMonthFilter((prev) => (prev === month ? "all" : month))
                  }
                  className={`card p-4 text-center transition-colors ${
                    active
                      ? "ring-2 ring-brand-400 bg-brand-50/50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs text-slate-500">
                    {monthLabel(month)}
                  </div>
                  <div
                    className={`text-2xl font-semibold mt-1 ${
                      count > 0 ? "text-brand-600" : "text-slate-400"
                    }`}
                  >
                    {num(count)}
                  </div>
                  <div className="text-xs text-slate-500">件</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter + Add */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ブランド名 / 店舗名で検索"
              className="input pl-9"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">全期間</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={startAdd}
            className="btn-primary inline-flex items-center gap-2 ml-auto"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                {editingId
                  ? "ホットペッパー連携追加を編集"
                  : "ホットペッパー連携を追加"}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ブランド名 (先) — 店舗追加/新規登録/HPB追加の履歴から候補を出す */}
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  ブランド名
                  {brandCandidates.length > 0 && (
                    <span className="text-[11px] text-slate-400 ml-2">
                      (過去に使用 {brandCandidates.length} 件)
                    </span>
                  )}
                </label>
                <div className="relative" ref={brandWrapRef}>
                  <input
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setBrandOpen(true);
                      setBrandHighlight(0);
                    }}
                    onFocus={() => setBrandOpen(true)}
                    onKeyDown={(e) => {
                      if (!brandOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        setBrandOpen(true);
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setBrandHighlight((h) =>
                          Math.min(h + 1, brandSuggestions.length - 1),
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setBrandHighlight((h) => Math.max(h - 1, 0));
                      } else if (e.key === "Enter") {
                        if (brandSuggestions[brandHighlight]) {
                          e.preventDefault();
                          setBrand(brandSuggestions[brandHighlight]);
                          setBrandOpen(false);
                        }
                      } else if (e.key === "Escape") {
                        setBrandOpen(false);
                      }
                    }}
                    placeholder={
                      brandCandidates.length > 0
                        ? "クリック or 入力して選択 (例: アイケアラボ)"
                        : "例: モアリジャパン"
                    }
                    className="input pr-8"
                    autoComplete="off"
                  />
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  {brandOpen && brandSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                      {brandSuggestions.map((name, i) => (
                        <li
                          key={name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setBrand(name);
                            setBrandOpen(false);
                          }}
                          onMouseEnter={() => setBrandHighlight(i)}
                          className={`px-3 py-2 cursor-pointer ${
                            i === brandHighlight
                              ? "bg-brand-50 text-brand-800"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {brandOpen &&
                    brandSuggestions.length === 0 &&
                    brandCandidates.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-slate-200 bg-white shadow-lg text-xs text-slate-500 px-3 py-2">
                        該当するブランドが見つかりません。このまま入力すれば自由入力で保存できます。
                      </div>
                    )}
                </div>
              </div>

              {/* 導入日 */}
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  導入日 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="input"
                />
              </div>

              {/* 店舗名 (後) — 任意入力に変更 (* 表示なし、空でも保存可能) */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-slate-700 block">
                  店舗名
                  <span className="text-[11px] text-slate-400 ml-2">(任意)</span>
                  {salonNames.length > 0 && (
                    <span className="text-[11px] text-slate-400 ml-2">
                      · シートから {salonNames.length} 件
                    </span>
                  )}
                </label>
                <div className="relative" ref={storeWrapRef}>
                  <input
                    value={store}
                    onChange={(e) => {
                      setStore(e.target.value);
                      setStoreOpen(true);
                      setStoreHighlight(0);
                    }}
                    onFocus={() => setStoreOpen(true)}
                    onKeyDown={(e) => {
                      if (!storeOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
                        setStoreOpen(true);
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setStoreHighlight((h) =>
                          Math.min(h + 1, storeSuggestions.length - 1),
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setStoreHighlight((h) => Math.max(h - 1, 0));
                      } else if (e.key === "Enter") {
                        if (storeSuggestions[storeHighlight]) {
                          e.preventDefault();
                          setStore(storeSuggestions[storeHighlight]);
                          setStoreOpen(false);
                        }
                      } else if (e.key === "Escape") {
                        setStoreOpen(false);
                      }
                    }}
                    placeholder={
                      salonNames.length > 0
                        ? "クリック or 入力して検索 (例: 松島)"
                        : "例: 松島先生（天元）"
                    }
                    className="input pr-8"
                    autoComplete="off"
                  />
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  {storeOpen && storeSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                      {storeSuggestions.map((name, i) => (
                        <li
                          key={name}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setStore(name);
                            setStoreOpen(false);
                          }}
                          onMouseEnter={() => setStoreHighlight(i)}
                          className={`px-3 py-2 cursor-pointer ${
                            i === storeHighlight
                              ? "bg-brand-50 text-brand-800"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {storeOpen &&
                    storeSuggestions.length === 0 &&
                    salonNames.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-slate-200 bg-white shadow-lg text-xs text-slate-500 px-3 py-2">
                        該当する店舗が見つかりません。このまま入力すれば自由入力で保存できます。
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="btn-ghost">
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={!installDate}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">導入日</th>
                  <th className="text-left font-medium px-4 py-3">ブランド名</th>
                  <th className="text-left font-medium px-4 py-3">店舗名</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {regs.length === 0
                        ? "ホットペッパー連携追加はまだありません。「新規追加」から追加してください。"
                        : "該当するホットペッパー連携追加が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.installDate}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.brand || "—"}</td>
                    <td className="px-4 py-3">{r.store || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(r)}
                        className="text-brand-700 hover:underline text-xs mr-3"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteReg(r.id)}
                        className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> 削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
