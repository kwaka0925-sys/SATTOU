"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { Plus, Search, Sparkles, Trash2, UserPlus } from "lucide-react";
import { num } from "@/lib/format";

const STORAGE_KEY = "sattou-new-registrations";

type HPBValue = "あり" | "なし";
type JoinType = "システム＋マーケ" | "システムのみ" | "マーケのみ";

const JOIN_TYPES: JoinType[] = [
  "システム＋マーケ",
  "システムのみ",
  "マーケのみ",
];

const JOIN_TYPE_STYLE: Record<JoinType, string> = {
  "システム＋マーケ": "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
  "システムのみ": "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  "マーケのみ": "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
};

type NewRegistration = {
  id: string;
  brand: string;
  store: string;
  representative: string;
  subscriberId: string; // 加入者識別番号 (システム/マーケいずれでも紐付け用に必要)
  installDate: string; // YYYY-MM-DD
  joinType: JoinType;
  hpbIntegrated: HPBValue;
  createdAt: string;
};

type Props = {
  year: number;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function newId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function yearMonths(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export default function NewRegistrationsView({ year }: Props) {
  const [regs, setRegs] = useState<NewRegistration[]>([]);
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [hpbFilter, setHpbFilter] = useState<"all" | HPBValue>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [brand, setBrand] = useState("");
  const [store, setStore] = useState("");
  const [representative, setRepresentative] = useState("");
  const [subscriberId, setSubscriberId] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [joinType, setJoinType] = useState<JoinType>("システム＋マーケ");
  const [hpb, setHpb] = useState<HPBValue>("なし");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // 旧レコードには joinType/subscriberId が存在しないので既定値で補う
          const migrated = parsed.map((r: NewRegistration) => ({
            ...r,
            joinType: r.joinType ?? "システム＋マーケ",
            subscriberId: r.subscriberId ?? "",
          }));
          setRegs(migrated);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: NewRegistration[]) => {
    setRegs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const resetForm = () => {
    setBrand("");
    setStore("");
    setRepresentative("");
    setSubscriberId("");
    setInstallDate("");
    setJoinType("システム＋マーケ");
    setHpb("なし");
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    const today = new Date().toISOString().slice(0, 10);
    setInstallDate(today);
    setShowForm(true);
  };

  const startEdit = (r: NewRegistration) => {
    setBrand(r.brand);
    setStore(r.store);
    setRepresentative(r.representative);
    setSubscriberId(r.subscriberId ?? "");
    setInstallDate(r.installDate);
    setJoinType(r.joinType ?? "システム＋マーケ");
    setHpb(r.hpbIntegrated);
    setEditingId(r.id);
    setShowForm(true);
  };

  const save = () => {
    const s = store.trim();
    if (!s || !installDate) return;
    const now = new Date().toISOString();
    const existing = editingId
      ? regs.find((r) => r.id === editingId)
      : undefined;
    const record: NewRegistration = {
      id: editingId ?? newId(),
      brand: brand.trim(),
      store: s,
      representative: representative.trim(),
      subscriberId: subscriberId.trim(),
      installDate,
      joinType,
      hpbIntegrated: hpb,
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
      !window.confirm("この新規登録を削除しますか？")
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
        if (hpbFilter !== "all" && r.hpbIntegrated !== hpbFilter) return false;
        if (q) {
          const qq = q.toLowerCase();
          const hay = `${r.brand} ${r.store} ${r.representative} ${r.subscriberId ?? ""}`.toLowerCase();
          if (!hay.includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.installDate < b.installDate ? 1 : -1));
  }, [regs, monthFilter, hpbFilter, q]);

  const hpbCount = regs.filter((r) => r.hpbIntegrated === "あり").length;

  return (
    <div>
      <TopBar
        title="新規登録"
        subtitle={`${year}年 · 累計 ${totalCount} 件 · 今月 ${thisMonthCount} 件 · HPB連携あり ${hpbCount} 件`}
      />
      <div className="p-6 space-y-4">
        {/* Monthly summary tiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" /> 月別新規加入数
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
              placeholder="ブランド名 / 店舗名 / 代表者名 / 識別番号で検索"
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
          <select
            value={hpbFilter}
            onChange={(e) => setHpbFilter(e.target.value as typeof hpbFilter)}
            className="input w-auto"
          >
            <option value="all">HPB すべて</option>
            <option value="あり">HPB あり</option>
            <option value="なし">HPB なし</option>
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
                <UserPlus className="w-4 h-4 text-brand-600" />
                {editingId ? "新規登録を編集" : "新規登録を追加"}
              </h2>
            </div>

            {/* テーブルの列順に合わせて 導入日 / 識別番号 / ブランド名 / 店舗名 /
                代表者名 / 入会方法 / HPB連携 の順に並べる */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  システムの導入日 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  加入者識別番号
                </label>
                <input
                  value={subscriberId}
                  onChange={(e) => setSubscriberId(e.target.value)}
                  placeholder="既存クライアントの識別番号 (数字)"
                  className="input font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  ブランド名
                </label>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="例: モアリジャパン"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  店舗名 <span className="text-rose-500">*</span>
                </label>
                <input
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  placeholder="例: 松島先生（天元）"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  代表者名
                </label>
                <input
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  placeholder="例: 山田 太郎"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  入会方法
                </label>
                <select
                  value={joinType}
                  onChange={(e) => setJoinType(e.target.value as JoinType)}
                  className={`input font-medium ${JOIN_TYPE_STYLE[joinType]}`}
                >
                  {JOIN_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-white text-slate-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700 block">
                  ホットペッパービューティー連携
                </label>
                <select
                  value={hpb}
                  onChange={(e) => setHpb(e.target.value as HPBValue)}
                  className={`input font-medium ${
                    hpb === "あり"
                      ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <option value="なし" className="bg-white text-slate-900">
                    なし
                  </option>
                  <option value="あり" className="bg-white text-slate-900">
                    あり
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="btn-ghost">
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={!store.trim() || !installDate}
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
                  <th className="text-left font-medium px-4 py-3">識別番号</th>
                  <th className="text-left font-medium px-4 py-3">ブランド名</th>
                  <th className="text-left font-medium px-4 py-3">店舗名</th>
                  <th className="text-left font-medium px-4 py-3">代表者名</th>
                  <th className="text-left font-medium px-4 py-3">入会方法</th>
                  <th className="text-left font-medium px-4 py-3">HPB連携</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {regs.length === 0
                        ? "新規登録はまだありません。「新規追加」から追加してください。"
                        : "該当する新規登録が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.installDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.subscriberId || "—"}
                    </td>
                    <td className="px-4 py-3">{r.brand || "—"}</td>
                    <td className="px-4 py-3 font-medium">{r.store}</td>
                    <td className="px-4 py-3">{r.representative || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`pill ${
                          JOIN_TYPE_STYLE[r.joinType ?? "システム＋マーケ"]
                        }`}
                      >
                        {r.joinType ?? "システム＋マーケ"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`pill ${
                          r.hpbIntegrated === "あり"
                            ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {r.hpbIntegrated}
                      </span>
                    </td>
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
