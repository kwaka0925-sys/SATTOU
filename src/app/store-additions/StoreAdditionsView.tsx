"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { num } from "@/lib/format";

const STORAGE_KEY = "sattou-store-additions";
// 既存 (旧スキーマ: joinType あり) の localStorage エントリーを一度だけ
// 新スキーマ (joinType 削除 + subscriberId 追加) に変換するためのフラグ。
// このフラグを立てるのは変換処理を実行した後、1 度きり。
const MIGRATION_SUBSCRIBER_V1 =
  "sattou-store-additions-migration-subscriberid-v1";

type HPBValue = "あり" | "なし";

// スプレッドシートから受け取ったアイケアラボの月別店舗追加分。
// バッチごとに独立の「投入済み」フラグを持つ。既に他バッチをシード済みでも、
// 新しいバッチが追加された時にそれだけを自動投入できる仕組み。
// 導入日はまとめて月初 1 日で仮置き。個別の日付は編集ボタンから修正可能。
type SeedBatch = {
  key: string; // 投入済みフラグの localStorage キー
  installDate: string;
  stores: Array<{ brand: string; store: string }>;
};

const SEED_BATCHES: SeedBatch[] = [
  {
    key: "sattou-store-additions-seeded-v1",
    installDate: "2026-05-01",
    stores: [
      { brand: "アイケアラボ", store: "アイケアLaBo武蔵小山店" },
      { brand: "アイケアラボ", store: "アイケアLaBo立川店" },
      { brand: "アイケアラボ", store: "アイケアLaBo浦安駅前店" },
      { brand: "アイケアラボ", store: "アイケアLaBo千葉駅前店" },
      { brand: "アイケアラボ", store: "アイケアLaBo郡山支店" },
      { brand: "アイケアラボ", store: "アイケアLaBo奈良新大宮店" },
      { brand: "アイケアラボ", store: "アイケアLaBo高松店" },
      { brand: "アイケアラボ", store: "アイケアLaBo前橋店" },
    ],
  },
  {
    key: "sattou-store-additions-seeded-v2-2026-06",
    installDate: "2026-06-01",
    stores: [
      { brand: "アイケアラボ", store: "アイケアLaBo岡山店" },
      { brand: "アイケアラボ", store: "アイケアLaBo日立大甕店" },
      { brand: "アイケアラボ", store: "アイケアLaBo岐阜駅前店" },
      { brand: "アイケアラボ", store: "アイケアLaBo経堂店" },
      { brand: "アイケアラボ", store: "アイケアLaBo伏見店" },
      { brand: "アイケアラボ", store: "アイケアLaBo刈谷店" },
      { brand: "アイケアラボ", store: "アイケアLaBo天満扇町店" },
      { brand: "アイケアラボ", store: "アイケアLaBo元町店" },
      { brand: "アイケアラボ", store: "アイケアLaBo赤羽店" },
      { brand: "アイケアラボ", store: "アイケアLaBo駒沢公園通り店" },
      { brand: "アイケアラボ", store: "アイケアLaBo中目黒店" },
    ],
  },
];

type StoreAddition = {
  id: string;
  brand: string;
  store: string;
  subscriberId: string; // 加入者識別番号 (クライアント既存店舗の追加分を紐付けるため)
  installDate: string; // YYYY-MM-DD
  hpbIntegrated: HPBValue;
  createdAt: string;
};

// マイグレーション前の旧レコード形式 (joinType が残っている可能性あり)。
// LocalStorage から読み出す時にだけ登場するので実行時のみ使う。
type LegacyStoreAddition = Partial<StoreAddition> & {
  joinType?: string;
  brand?: string;
  store?: string;
  installDate?: string;
  hpbIntegrated?: HPBValue;
};

type Props = {
  year: number;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function newId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function yearMonths(year: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

// 旧レコードから joinType を落として subscriberId を追加する変換。
// 実行時のガードとしてフィールド有無だけをチェック。
function normalizeRecord(r: LegacyStoreAddition, i: number): StoreAddition {
  return {
    id: (r.id as string) ?? `s-migrated-${i}-${Date.now().toString(36)}`,
    brand: r.brand ?? "",
    store: r.store ?? "",
    subscriberId: r.subscriberId ?? "",
    installDate: r.installDate ?? "",
    hpbIntegrated: (r.hpbIntegrated as HPBValue) ?? "なし",
    createdAt: r.createdAt ?? new Date().toISOString(),
  };
}

export default function StoreAdditionsView({ year }: Props) {
  const [regs, setRegs] = useState<StoreAddition[]>([]);
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [brand, setBrand] = useState("");
  const [store, setStore] = useState("");
  const [subscriberId, setSubscriberId] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [hpb, setHpb] = useState<HPBValue>("なし");

  useEffect(() => {
    try {
      // 既存の保存データを読み込み。無ければ空から開始。
      const stored = window.localStorage.getItem(STORAGE_KEY);
      let current: StoreAddition[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          current = parsed.map((r, i) => normalizeRecord(r, i));
        }
      }

      let mutated = false;

      // 旧スキーマ (joinType 保持) → 新スキーマ (subscriberId) への 1 度きり変換。
      // normalizeRecord で保存済みでも安全だが、明示的にフラグを立てて記録する。
      if (!window.localStorage.getItem(MIGRATION_SUBSCRIBER_V1)) {
        mutated = true; // 保存時に古い joinType が消える
        window.localStorage.setItem(MIGRATION_SUBSCRIBER_V1, "1");
      }

      // 各シードバッチについて「まだ投入されていなければ」その分だけ追記する。
      // これで v1 (5月分) を投入済みのユーザーも v2 (6月分) を追加受領できる。
      // 各バッチのフラグは独立なので、削除後の再投入も起きない。
      const now = new Date().toISOString();
      for (const batch of SEED_BATCHES) {
        if (window.localStorage.getItem(batch.key)) continue;
        const additions: StoreAddition[] = batch.stores.map((d) => ({
          id: newId(),
          brand: d.brand,
          store: d.store,
          subscriberId: "",
          installDate: batch.installDate,
          hpbIntegrated: "なし",
          createdAt: now,
        }));
        current = [...current, ...additions];
        window.localStorage.setItem(batch.key, "1");
        mutated = true;
      }

      setRegs(current);
      if (mutated) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: StoreAddition[]) => {
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
    setSubscriberId("");
    setInstallDate("");
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

  const startEdit = (r: StoreAddition) => {
    setBrand(r.brand);
    setStore(r.store);
    setSubscriberId(r.subscriberId);
    setInstallDate(r.installDate);
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
    const record: StoreAddition = {
      id: editingId ?? newId(),
      brand: brand.trim(),
      store: s,
      subscriberId: subscriberId.trim(),
      installDate,
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
      !window.confirm("この店舗追加を削除しますか？")
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
          const hay = `${r.brand} ${r.store} ${r.subscriberId}`.toLowerCase();
          if (!hay.includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.installDate < b.installDate ? 1 : -1));
  }, [regs, monthFilter, q]);

  return (
    <div>
      <TopBar
        title="店舗追加"
        subtitle={`${year}年 · 累計 ${totalCount} 件 · 今月 ${thisMonthCount} 件`}
      />
      <div className="p-6 space-y-4">
        {/* Monthly summary tiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-brand-600" /> 月別店舗追加数
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
              placeholder="ブランド名 / 店舗名 / 識別番号で検索"
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
            店舗追加
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <StoreIcon className="w-4 h-4 text-brand-600" />
                {editingId ? "店舗追加を編集" : "新しい店舗を追加"}
              </h2>
            </div>

            {/* テーブルの列順に合わせて 導入日 / 識別番号 / ブランド名 / 店舗名 / HPB連携 の順に並べる */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Table (列順: 導入日 / 識別番号 / ブランド名 / 店舗名 / HPB連携) */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">導入日</th>
                  <th className="text-left font-medium px-4 py-3">識別番号</th>
                  <th className="text-left font-medium px-4 py-3">ブランド名</th>
                  <th className="text-left font-medium px-4 py-3">店舗名</th>
                  <th className="text-left font-medium px-4 py-3">HPB連携</th>
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
                      {regs.length === 0
                        ? "店舗追加はまだありません。「店舗追加」から追加してください。"
                        : "該当する店舗追加が見つかりませんでした。"}
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
