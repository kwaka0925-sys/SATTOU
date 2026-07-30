"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import {
  UserX,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import type { ManualCancellation, SheetInvoice } from "@/lib/sheets";
import type { MonthRows } from "./page";

type EditableField =
  | "paymentMethod"
  | "status"
  | "subscriptionStatus"
  | "marketer"
  | "note";
type RowOverride = Partial<Record<EditableField, string>>;
type OverridesMap = Record<string, RowOverride>;

const OVERRIDES_STORAGE_KEY = "sattou-invoice-overrides";

type Props = {
  monthlyRows: MonthRows[];
  manualCancellations: ManualCancellation[];
  configured: boolean;
  year: number;
};

// 表示用の統合レコード。請求書由来と手動追加を同じ形にする。
type DisplayRow = {
  key: string; // React key 用の一意 ID
  isManual: boolean;
  manualId?: string; // 手動追加行のみ、編集/削除の対象キー
  month: string; // YYYY-MM (表示上の解約月)
  salonName: string;
  storeName: string; // 手動追加のみ埋まる。請求書由来は空。
  subscriberId: string;
  payeeName: string;
  subscriptionStatus: string;
  marketer: string;
  note: string;
  clientId: string | null; // /clients/[id] へのリンク用
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function shortMonth(month: string): string {
  const [, m] = month.split("-");
  return `${parseInt(m, 10)}月`;
}

// yearMonths(2026) → ["2026-01", ..., "2026-12"] (追加フォームの月選択肢用)
function yearMonths(year: number): string[] {
  const arr: string[] = [];
  for (let m = 1; m <= 12; m++) {
    arr.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return arr;
}

// --- API 呼び出し (共通) -----------------------------------------
type ManualFormFields = {
  month: string;
  salonName: string;
  storeName: string;
  subscriberId: string;
  payeeName: string;
  marketer: string;
  note: string;
};

const EMPTY_MANUAL_FORM: ManualFormFields = {
  month: "",
  salonName: "",
  storeName: "",
  subscriberId: "",
  payeeName: "",
  marketer: "",
  note: "",
};

async function callManualApi(body: {
  action: "add" | "update" | "delete";
  id?: string;
  data?: ManualFormFields;
  patch?: Partial<ManualFormFields>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/cancellations/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: "unknown" }))) as {
        error?: string;
      };
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

export default function CancellationsView({
  monthlyRows,
  manualCancellations,
  configured,
  year,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [overrides, setOverrides] = useState<OverridesMap>({});
  const [refreshing, setRefreshing] = useState(false);
  // 追加/編集フォーム。id が入っている = 編集モード。
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManualFormFields>(EMPTY_MANUAL_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setOverrides(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 請求書由来: 同一クライアントは最初に「解約」が現れた月にだけ載せる。
  const sheetDerived = useMemo(() => {
    const seen = new Set<string>();
    return monthlyRows.map(({ month, rows }) => {
      const cancelled = rows.filter((r) => {
        const overrideSub = overrides[r.id]?.subscriptionStatus;
        const effective = overrideSub ?? r.subscriptionStatus ?? "";
        if (!effective.includes("解約")) return false;
        const key = (r.subscriberId ?? r.clientName ?? "").trim();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { month, cancelled };
    });
  }, [monthlyRows, overrides]);

  // 統合表示用のリスト。請求書由来と手動追加を一本化。
  const allDisplayRows = useMemo(() => {
    const out: DisplayRow[] = [];
    for (const { month, cancelled } of sheetDerived) {
      for (const r of cancelled) {
        const sub =
          overrides[r.id]?.subscriptionStatus ?? r.subscriptionStatus ?? "";
        const marketer = overrides[r.id]?.marketer ?? r.marketer ?? "";
        const note = overrides[r.id]?.note ?? r.note ?? "";
        out.push({
          key: `sheet-${month}-${r.id}`,
          isManual: false,
          month,
          salonName: r.clientName,
          storeName: "",
          subscriberId: r.subscriberId ?? "",
          payeeName: r.payeeName ?? "",
          subscriptionStatus: sub,
          marketer,
          note,
          clientId: r.clientId,
        });
      }
    }
    for (const m of manualCancellations) {
      out.push({
        key: `manual-${m.id}`,
        isManual: true,
        manualId: m.id,
        month: m.month,
        salonName: m.salonName,
        storeName: m.storeName,
        subscriberId: m.subscriberId,
        payeeName: m.payeeName,
        subscriptionStatus: "解約",
        marketer: m.marketer,
        note: m.note,
        clientId: null,
      });
    }
    return out;
  }, [sheetDerived, manualCancellations, overrides]);

  // 月別集計。月タイル数字と累計に使う。
  const countsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of allDisplayRows) {
      if (!row.month) continue;
      map.set(row.month, (map.get(row.month) ?? 0) + 1);
    }
    return map;
  }, [allDisplayRows]);

  const totalCount = allDisplayRows.length;

  const filtered = useMemo(() => {
    return allDisplayRows.filter((row) => {
      if (monthFilter !== "all" && row.month !== monthFilter) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [
          row.salonName,
          row.storeName,
          row.subscriberId,
          row.payeeName,
          row.marketer,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [allDisplayRows, q, monthFilter]);

  // 月表示用の 12 ヶ月。タイル生成にだけ使う。
  const displayMonths = useMemo(() => yearMonths(year), [year]);
  const currentMonthIdx = new Date().getMonth();
  const thisMonthKey = displayMonths[currentMonthIdx];
  const thisMonthCount = countsByMonth.get(thisMonthKey) ?? 0;

  // ---- add / edit / delete ---------------------------------------
  const openAdd = useCallback(() => {
    // 追加フォームの初期値。月はデフォルトで今月。
    const defaultMonth = displayMonths[currentMonthIdx] ?? displayMonths[0];
    setEditingId(null);
    setForm({ ...EMPTY_MANUAL_FORM, month: defaultMonth });
    setSubmitError(null);
    setFormOpen(true);
  }, [displayMonths, currentMonthIdx]);

  const openEdit = useCallback((m: ManualCancellation) => {
    setEditingId(m.id);
    setForm({
      month: m.month,
      salonName: m.salonName,
      storeName: m.storeName,
      subscriberId: m.subscriberId,
      payeeName: m.payeeName,
      marketer: m.marketer,
      note: m.note,
    });
    setSubmitError(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_MANUAL_FORM);
    setSubmitError(null);
  }, []);

  const submitForm = useCallback(async () => {
    if (!form.month) {
      setSubmitError("解約月を選択してください");
      return;
    }
    if (!form.salonName.trim() && !form.storeName.trim()) {
      setSubmitError("サロン名 か 店舗名 のどちらかは入力してください");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = editingId
      ? await callManualApi({ action: "update", id: editingId, patch: form })
      : await callManualApi({ action: "add", data: form });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "保存に失敗しました");
      return;
    }
    closeForm();
    // 追加/更新後はサーバー側から取り直して表示に反映する。
    try {
      await fetch("/api/cancellations/revalidate", { method: "POST" });
    } catch {
      // ignore
    }
    router.refresh();
  }, [editingId, form, closeForm, router]);

  const deleteManual = useCallback(
    async (id: string, label: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`「${label}」を削除しますか？`)
      ) {
        return;
      }
      const result = await callManualApi({ action: "delete", id });
      if (!result.ok) {
        alert(`削除に失敗しました: ${result.error ?? "unknown"}`);
        return;
      }
      try {
        await fetch("/api/cancellations/revalidate", { method: "POST" });
      } catch {
        // ignore
      }
      router.refresh();
    },
    [router],
  );

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/cancellations/revalidate", { method: "POST" });
    } catch {
      // ignore
    }
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  return (
    <div>
      <TopBar
        title="解約一覧"
        subtitle={`${year}年 · 累計解約 ${totalCount} 件 · 今月 ${thisMonthCount} 件`}
      />
      <div className="p-6 space-y-6">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL_BILLING</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN_BILLING </code>
            を Vercel の環境変数に登録すると、請求書シートの実データがこの画面に反映されます。
          </div>
        )}

        {/* Monthly summary tiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-600" /> 月別解約数
            </h2>
            <div className="text-xs text-slate-500">
              翌月請求書シートの継続=解約 + 手動追加 (同一クライアントは重複カウントしません)
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {displayMonths.map((m) => {
              const count = countsByMonth.get(m) ?? 0;
              const active = monthFilter === m;
              return (
                <button
                  key={m}
                  onClick={() =>
                    setMonthFilter((prev) => (prev === m ? "all" : m))
                  }
                  className={`card p-4 text-center transition-colors ${
                    active
                      ? "ring-2 ring-rose-400 bg-rose-50/50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs text-slate-500">{monthLabel(m)}</div>
                  <div
                    className={`text-2xl font-semibold mt-1 ${
                      count > 0 ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {num(count)}
                  </div>
                  <div className="text-xs text-slate-500">名</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter row + Add button */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 店舗名 / 識別番号 / 振込名 / 担当で検索"
              className="input pl-9"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">全期間</option>
            {displayMonths
              .filter((m) => (countsByMonth.get(m) ?? 0) > 0)
              .map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={doRefresh}
              disabled={refreshing}
              className="btn-ghost text-xs inline-flex items-center gap-1"
              title="他ユーザーの追加を取り込む"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              シート更新
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="btn-primary inline-flex items-center gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              解約を追加
            </button>
            <div className="text-xs text-slate-500 ml-2">
              表示 {filtered.length} / 累計 {totalCount} 件
            </div>
          </div>
        </div>

        {/* Detail table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">解約月</th>
                  <th className="text-left font-medium px-4 py-3">サロン名</th>
                  <th className="text-left font-medium px-4 py-3">店舗名</th>
                  <th className="text-left font-medium px-4 py-3">
                    加入者識別番号
                  </th>
                  <th className="text-left font-medium px-4 py-3">振込名</th>
                  <th className="text-left font-medium px-4 py-3">継続</th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {totalCount === 0
                        ? "解約はまだ記録されていません。「解約を追加」から入力できます。"
                        : "該当する解約が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span
                        className={`pill ${
                          row.isManual
                            ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {shortMonth(row.month)}
                        {row.isManual ? " (手動)" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.clientId ? (
                        <Link
                          href={`/clients/${row.clientId}`}
                          className="hover:text-brand-700"
                        >
                          {row.salonName || "—"}
                        </Link>
                      ) : (
                        row.salonName || "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate" title={row.storeName}>
                      {row.storeName || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.subscriberId || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.payeeName || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.subscriptionStatus || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.marketer || "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-500 max-w-[280px] truncate"
                      title={row.note}
                    >
                      {row.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {row.isManual && row.manualId && (
                        <>
                          <button
                            onClick={() => {
                              const found = manualCancellations.find(
                                (m) => m.id === row.manualId,
                              );
                              if (found) openEdit(found);
                            }}
                            className="text-brand-700 hover:underline text-xs mr-3"
                            title="編集"
                          >
                            <Pencil className="w-3 h-3 inline" />
                          </button>
                          <button
                            onClick={() =>
                              deleteManual(
                                row.manualId!,
                                row.salonName || row.storeName || "無題",
                              )
                            }
                            className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1"
                            title="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-600" />
                {editingId ? "解約を編集" : "解約を追加"}
              </h2>
              <button
                onClick={closeForm}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-600 block">
                  解約月 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  className="input"
                >
                  <option value="">選択してください</option>
                  {displayMonths.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600 block">
                  サロン名 (ブランド名)
                </label>
                <input
                  type="text"
                  value={form.salonName}
                  onChange={(e) =>
                    setForm({ ...form, salonName: e.target.value })
                  }
                  placeholder="例: 松島先生"
                  className="input"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-600 block">
                  店舗名 (メモ)
                </label>
                <input
                  type="text"
                  value={form.storeName}
                  onChange={(e) =>
                    setForm({ ...form, storeName: e.target.value })
                  }
                  placeholder="例: 天元本店 / PILATES RE+ など特定店舗名"
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600 block">
                  加入者識別番号 (任意)
                </label>
                <input
                  type="text"
                  value={form.subscriberId}
                  onChange={(e) =>
                    setForm({ ...form, subscriberId: e.target.value })
                  }
                  placeholder="例: 152"
                  className="input font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600 block">
                  振込名 (任意)
                </label>
                <input
                  type="text"
                  value={form.payeeName}
                  onChange={(e) =>
                    setForm({ ...form, payeeName: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600 block">
                  担当 (任意)
                </label>
                <input
                  type="text"
                  value={form.marketer}
                  onChange={(e) =>
                    setForm({ ...form, marketer: e.target.value })
                  }
                  placeholder="例: 糸谷 / システムのみ"
                  className="input"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-600 block">メモ (任意)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="input resize-y"
                />
              </div>
            </div>

            {submitError && (
              <div className="text-xs text-rose-700 inline-flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={closeForm} className="btn-ghost text-xs">
                キャンセル
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submitting
                  ? "保存中..."
                  : editingId
                    ? "更新"
                    : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
