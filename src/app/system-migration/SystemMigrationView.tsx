"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import { num } from "@/lib/format";
import type {
  MigrationStatusRecord,
  SheetInvoice,
} from "@/lib/sheets";

// 旧 localStorage キー (clientName → MigrationStatus)。
// シート化後は sheet 側が真実の値だが、既存ユーザーがブラウザに持っている
// ローカルデータを 1 度だけシートに送り込むために使う。
const LEGACY_STORAGE_KEY = "sattou-system-migration";
// このバージョンのマイグレーションを実行済みか記録するフラグ。
const LEGACY_MIGRATED_FLAG = "sattou-system-migration-uploaded-v1";

type MigrationStatus = {
  completed: boolean;
  migrationDate: string; // YYYY-MM-DD
  plannedDate: string; // YYYY-MM-DD
  note: string;
};

type MigrationMap = Record<string, MigrationStatus>; // key = subscriberId

type Props = {
  rows: SheetInvoice[];
  month: string;
  configured: boolean;
  sheetName?: string;
  expectedSheets?: string[];
  sheetMatched?: boolean;
  initialMigrations: Record<string, MigrationStatusRecord>;
};

type StatusFilter = "all" | "completed" | "blank";

// 並び替え対象と方向。null は元順 (シート順)。
type SortKey = "migrationDate" | "plannedDate";
type SortDir = "asc" | "desc";

// 書き込み状況の表示ステータス。
type SyncBadge =
  | { kind: "idle" }
  | { kind: "saving"; count: number }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-");
  const mNum = parseInt(m, 10);
  const opMonth = mNum === 1 ? 12 : mNum - 1;
  return `${y}年${mNum}月分（${opMonth}月稼働分）`;
}

// GAS の migrations レスポンス (subscriberId → record) を、
// この画面が持つ MigrationMap (同じ形) に変換。
// GAS が想定外の shape を返した場合や initial が null/undefined の時にも
// 落ちないように、防御的に空マップへフォールバック。
function fromInitial(
  initial: Record<string, MigrationStatusRecord> | null | undefined,
): MigrationMap {
  const out: MigrationMap = {};
  if (!initial || typeof initial !== "object") return out;
  for (const [sid, r] of Object.entries(initial)) {
    if (!r || typeof r !== "object") continue;
    out[sid] = {
      completed: !!r.completed,
      migrationDate: r.migrationDate ?? "",
      plannedDate: r.plannedDate ?? "",
      note: r.note ?? "",
    };
  }
  return out;
}

function getStatus(map: MigrationMap, subscriberId: string): MigrationStatus {
  const stored = map[subscriberId];
  return {
    completed: stored?.completed ?? false,
    migrationDate: stored?.migrationDate ?? "",
    plannedDate: stored?.plannedDate ?? "",
    note: stored?.note ?? "",
  };
}

// サーバー側 API に patch を送る。成功したら true。
async function postPatch(
  subscriberId: string,
  clientName: string,
  patch: Partial<MigrationStatus>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/system-migration/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriberId, clientName, patch }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return !!data.ok;
  } catch {
    return false;
  }
}

export default function SystemMigrationView({
  rows,
  month,
  configured,
  sheetName,
  expectedSheets,
  sheetMatched,
  initialMigrations,
}: Props) {
  const router = useRouter();

  // 現在描画中の migrations。SSR で来た initialMigrations を初期値に、
  // ユーザー編集で楽観的に更新する。
  const [migrations, setMigrations] = useState<MigrationMap>(() =>
    fromInitial(initialMigrations),
  );
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [syncBadge, setSyncBadge] = useState<SyncBadge>({ kind: "idle" });
  const [refreshing, setRefreshing] = useState(false);

  // メモ入力のデバウンス。subscriberId ごとに 500ms 遅延で書き込みたいので、
  // タイマー ID を id ごとに保持しておく。
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  // 進行中の書き込みカウント。0 になった時に saved 表示に切り替える。
  const inFlightRef = useRef(0);

  // サーバー側の initialMigrations が変わった (別ユーザーの編集を再フェッチした等)
  // 時に、ローカル state を上書きして反映する。編集中のセルに影響を与えるが、
  // 「他人の値で上書き」は原則許容 (last write wins)。
  useEffect(() => {
    setMigrations(fromInitial(initialMigrations));
  }, [initialMigrations]);

  // 旧 localStorage データを 1 度だけシートに送り込むマイグレーション。
  // clientName → subscriberId の紐付けは rows から引く。
  // シート側に既に値がある行 (initialMigrations に載っている) は上書きせず尊重。
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(LEGACY_MIGRATED_FLAG)) return;
    let stored: Record<string, MigrationStatus> | null = null;
    try {
      const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") stored = parsed;
      }
    } catch {
      // ignore
    }
    if (!stored) {
      window.localStorage.setItem(LEGACY_MIGRATED_FLAG, "1");
      return;
    }

    // clientName → subscriberId マップ (現在の rows から)
    const nameToSid: Record<string, string> = {};
    for (const r of rows) {
      const sid = (r.subscriberId ?? "").trim();
      if (!sid) continue;
      const name = (r.clientName ?? "").trim();
      if (name && !nameToSid[name]) nameToSid[name] = sid;
    }

    const uploads: Array<Promise<boolean>> = [];
    for (const [clientName, s] of Object.entries(stored)) {
      const sid = nameToSid[clientName];
      if (!sid) continue;
      // シート側に既に何か入っている行は触らない (他ユーザーが先に書き込んでいる可能性)。
      if (initialMigrations[sid]) continue;
      const patch: Partial<MigrationStatus> = {
        completed: !!s.completed,
        migrationDate: s.migrationDate ?? "",
        plannedDate: s.plannedDate ?? "",
        note: s.note ?? "",
      };
      // 全部空なら送らない
      const anyValue =
        patch.completed || patch.migrationDate || patch.plannedDate || patch.note;
      if (!anyValue) continue;
      uploads.push(postPatch(sid, clientName, patch));
    }

    if (uploads.length === 0) {
      window.localStorage.setItem(LEGACY_MIGRATED_FLAG, "1");
      return;
    }

    setSyncBadge({ kind: "saving", count: uploads.length });
    Promise.all(uploads).then(() => {
      window.localStorage.setItem(LEGACY_MIGRATED_FLAG, "1");
      setSyncBadge({ kind: "saved", at: Date.now() });
      // 送信結果をシートから引き直し、共通ビューに揃える。
      router.refresh();
    });
  }, [rows, initialMigrations, router]);

  // タブがフォアグラウンドに戻った時に、他ユーザーの編集を取り込む。
  useEffect(() => {
    const onFocus = async () => {
      try {
        await fetch("/api/system-migration/revalidate", { method: "POST" });
      } catch {
        // ignore
      }
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  // 楽観的更新 + サーバー送信。共通ロジック。
  const applyPatch = useCallback(
    (subscriberId: string, clientName: string, patch: Partial<MigrationStatus>) => {
      setMigrations((prev) => {
        const current = getStatus(prev, subscriberId);
        return { ...prev, [subscriberId]: { ...current, ...patch } };
      });
      inFlightRef.current += 1;
      setSyncBadge({ kind: "saving", count: inFlightRef.current });
      postPatch(subscriberId, clientName, patch).then((ok) => {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (!ok) {
          setSyncBadge({
            kind: "error",
            message: "シートへの保存に失敗しました。時間をおいて再試行してください。",
          });
          return;
        }
        if (inFlightRef.current === 0) {
          setSyncBadge({ kind: "saved", at: Date.now() });
        } else {
          setSyncBadge({ kind: "saving", count: inFlightRef.current });
        }
      });
    },
    [],
  );

  const toggleCompleted = useCallback(
    (subscriberId: string, clientName: string) => {
      setMigrations((prev) => {
        const current = getStatus(prev, subscriberId);
        applyPatch(subscriberId, clientName, { completed: !current.completed });
        return prev;
      });
    },
    [applyPatch],
  );

  const setDate = useCallback(
    (subscriberId: string, clientName: string, date: string) => {
      applyPatch(subscriberId, clientName, { migrationDate: date });
    },
    [applyPatch],
  );

  const setPlannedDate = useCallback(
    (subscriberId: string, clientName: string, date: string) => {
      applyPatch(subscriberId, clientName, { plannedDate: date });
    },
    [applyPatch],
  );

  // メモは打鍵ごとの POST を避けるため 500ms デバウンス。
  const setNote = useCallback(
    (subscriberId: string, clientName: string, note: string) => {
      // まずローカルは即時更新して、入力体感を損なわない。
      setMigrations((prev) => {
        const current = getStatus(prev, subscriberId);
        return { ...prev, [subscriberId]: { ...current, note } };
      });
      const timers = noteTimersRef.current;
      if (timers[subscriberId]) clearTimeout(timers[subscriberId]);
      timers[subscriberId] = setTimeout(() => {
        applyPatch(subscriberId, clientName, { note });
      }, 500);
    },
    [applyPatch],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const sid = (r.subscriberId ?? "").trim();
      const status = getStatus(migrations, sid);
      if (statusFilter === "completed" && !status.completed) return false;
      if (statusFilter === "blank" && status.completed) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = `${r.clientName} ${r.subscriberId ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, migrations, statusFilter, q]);

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    const dirMul = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const asid = (a.subscriberId ?? "").trim();
      const bsid = (b.subscriberId ?? "").trim();
      const av = getStatus(migrations, asid)[sortKey];
      const bv = getStatus(migrations, bsid)[sortKey];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv) * dirMul;
    });
  }, [filtered, migrations, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir("asc");
      } else if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    },
    [sortKey, sortDir],
  );

  const totals = useMemo(() => {
    let completed = 0;
    let blank = 0;
    for (const r of rows) {
      const sid = (r.subscriberId ?? "").trim();
      const s = getStatus(migrations, sid);
      if (s.completed) completed++;
      else blank++;
    }
    return {
      total: rows.length,
      completed,
      blank,
      rate: rows.length > 0 ? (completed / rows.length) * 100 : 0,
    };
  }, [rows, migrations]);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/system-migration/revalidate", { method: "POST" });
    } catch {
      // ignore
    }
    router.refresh();
    // Next の refresh は同期的に「完了」を通知しないので短めのタイマで戻す。
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        title="新システム移行"
        subtitle={`${monthTitle(month)} · 全 ${rows.length} 社 / 表示 ${sortedFiltered.length} 社`}
      />
      <div className="shrink-0 p-6 pb-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">月表示</div>
          <div className="flex items-center gap-3">
            {/* 保存状態のバッジ。共有シートに書き戻し中/完了/エラーを表示。 */}
            <SyncStatus badge={syncBadge} />
            <button
              type="button"
              onClick={doRefresh}
              disabled={refreshing}
              className="btn-ghost text-xs inline-flex items-center gap-1"
              title="他ユーザーの編集を取り込む"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              シート更新
            </button>
            <MonthPicker current={month} />
          </div>
        </div>

        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL_BILLING</code>{" "}
            と
            <code className="font-mono"> SHEETS_GAS_TOKEN_BILLING </code>
            を Vercel の環境変数に登録すると、請求書シートのクライアント一覧がこの画面に反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
          </div>
        )}

        {/* シート名の不一致警告 */}
        {configured && sheetName && sheetMatched === false && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-900 text-xs px-4 py-3 space-y-1">
            <div className="font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              シートタブ名が一致していません
            </div>
            <div className="leading-relaxed">
              GAS が返したタブ:
              <code className="font-mono ml-1 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                {sheetName}
              </code>
            </div>
            {expectedSheets && (
              <div className="text-[11px] text-rose-700 leading-relaxed">
                期待するタブ名 ({monthLabel(month)}分):{" "}
                {expectedSheets.map((n, i) => (
                  <code
                    key={i}
                    className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 ml-1 mt-1 inline-block"
                  >
                    {n}
                  </code>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総クライアント数</div>
            <div className="text-2xl font-semibold mt-1">
              {num(totals.total)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">移行完了</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600">
              {num(totals.completed)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-rose-600">未実施</div>
            <div className="text-2xl font-semibold mt-1 text-rose-700">
              {num(totals.blank)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">進捗率</div>
            <div className="text-2xl font-semibold mt-1 text-brand-700">
              {totals.rate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="クライアント名 / 識別番号で検索"
              className="input pl-9"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">状態すべて</option>
            <option value="completed">移行完了</option>
            <option value="blank">未実施</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="card h-full flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide shadow-sm">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-30 w-[240px] max-w-[240px]">
                    クライアント名
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[90px]">
                    ブランド数
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[90px]">
                    店舗数
                  </th>
                  <th className="text-center font-medium px-4 py-3 w-[110px]">
                    識別番号
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[140px]">
                    システム移行
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[160px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("migrationDate")}
                      className="inline-flex items-center gap-1 hover:text-brand-700"
                    >
                      システム移行日
                      {sortKey === "migrationDate" ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="text-left font-medium px-4 py-3 w-[160px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("plannedDate")}
                      className="inline-flex items-center gap-1 hover:text-brand-700"
                    >
                      システム移行予定日
                      {sortKey === "plannedDate" ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="text-left font-medium px-4 py-3 min-w-[320px]">
                    メモ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      表示できるクライアントがありません。
                    </td>
                  </tr>
                )}
                {sortedFiltered.map((r) => {
                  const sid = (r.subscriberId ?? "").trim();
                  const status = getStatus(migrations, sid);
                  // 加入者識別番号が無い行は共有できないので、UI 上グレーアウトする。
                  const shareable = !!sid;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 font-medium truncate max-w-[240px]">
                        {r.clientName}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {r.brandCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {r.storeCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {r.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={status.completed}
                            disabled={!shareable}
                            onChange={() =>
                              toggleCompleted(sid, r.clientName)
                            }
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                          />
                          <span
                            className={`pill ${
                              status.completed
                                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                            }`}
                          >
                            {status.completed ? "完了" : "未実施"}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={status.migrationDate}
                          disabled={!shareable}
                          onChange={(e) =>
                            setDate(sid, r.clientName, e.target.value)
                          }
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={status.plannedDate}
                          disabled={!shareable}
                          onChange={(e) =>
                            setPlannedDate(sid, r.clientName, e.target.value)
                          }
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={status.note}
                          disabled={!shareable}
                          onChange={(e) =>
                            setNote(sid, r.clientName, e.target.value)
                          }
                          placeholder={
                            shareable ? "メモを入力" : "識別番号未設定"
                          }
                          className="w-full text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-40"
                        />
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

function SyncStatus({ badge }: { badge: SyncBadge }) {
  if (badge.kind === "idle") return null;
  if (badge.kind === "saving") {
    return (
      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
        <RefreshCw className="w-3 h-3 animate-spin" />
        シートに保存中... ({badge.count})
      </span>
    );
  }
  if (badge.kind === "saved") {
    return (
      <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
        ✓ 保存済み (共有シート)
      </span>
    );
  }
  return (
    <span className="text-xs text-rose-700 inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      {badge.message}
    </span>
  );
}
