"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { yen, pct } from "@/lib/format";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import StatCard from "@/components/StatCard";
import {
  AlertTriangle,
  ArrowUpDown,
  Coins,
  Copy,
  ExternalLink,
  Filter,
  Megaphone,
  Percent,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import type { SheetInvoice } from "@/lib/sheets";
import {
  applyOrderOverrides,
  useOrderOverrides,
} from "@/lib/rowOrderOverrides";
import ReorderDialog from "@/components/ReorderDialog";

type Props = {
  rows: SheetInvoice[];
  month: string;
  configured: boolean;
  isMock: boolean;
  sheetName?: string;
  expectedSheets?: string[];
  sheetMatched?: boolean;
};

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

// 稼働月 = 表示月の前月をデフォルトに (「2026年7月分（6月稼働分）」の運用月）
function operatingMonthRange(month: string): { since: string; until: string } {
  const [y, m] = month.split("-").map((v) => parseInt(v, 10));
  const opYear = m === 1 ? y - 1 : y;
  const opMonth = m === 1 ? 12 : m - 1;
  const mm = String(opMonth).padStart(2, "0");
  const lastDay = new Date(opYear, opMonth, 0).getDate();
  return {
    since: `${opYear}-${mm}-01`,
    until: `${opYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

type SyncResult = {
  clientKey: string;
  clientName: string;
  adAccountId: string;
  spend: number;
  currency?: string;
  error?: string;
};

type SyncSuccess = {
  status: "success";
  results: SyncResult[];
  matched: number;
  total: number;
  totalSpend: number;
  errorCount: number;
  since: string;
  until: string;
  // 同期完了時刻 (ISO 文字列)。UI では「M月D日 HH時MM分」に整形して表示する。
  syncedAt: string;
};

type SyncState =
  | { status: "idle" }
  | { status: "loading"; previous?: SyncSuccess }
  | SyncSuccess
  | { status: "error"; message: string; previous?: SyncSuccess };

// Meta 同期成功後にシート S 列へ書き戻す処理の状態表示。
type WritebackState =
  | { status: "idle" }
  | { status: "writing"; count: number }
  | { status: "done"; updated: number; missing: number; at: string }
  | { status: "error"; message: string };

// localStorage キー: 月ごとに前回の同期結果をキャッシュしておく。
// 開いた瞬間にキャッシュを描画してから背景でリフレッシュを走らせる。
const SYNC_CACHE_KEY = "sattou-meta-ads-sync-cache";

// 同期が古すぎるかの判定に使うしきい値。これより古ければ自動リフレッシュを走らせる。
const AUTO_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 分

type SyncCache = Record<string, SyncSuccess>;

function loadSyncCache(): SyncCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SYNC_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // キャッシュエントリーが古い or 破損している場合に results 等の必須フィールドが
    // 欠けているケースがあり、そのまま渡すと activeSuccess.results.forEach 等で
    // 落ちる。ここで shape 検証し、不正なエントリーは捨てる。
    const clean: SyncCache = {};
    for (const [month, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Partial<SyncSuccess>;
      if (
        e.status === "success" &&
        Array.isArray(e.results) &&
        typeof e.syncedAt === "string"
      ) {
        clean[month] = e as SyncSuccess;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function persistSyncCache(cache: SyncCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
}

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}月${day}日 ${hh}時${mm}分`;
}

export default function AdsView({
  rows,
  month,
  configured,
  isMock,
  sheetName,
  expectedSheets,
  sheetMatched,
}: Props) {
  const [q, setQ] = useState("");
  const [marketer, setMarketer] = useState<string>("all");
  // 同期期間は「表示月の稼働月」に固定 (例: 8月請求 → 7/1〜7/31)。
  // 別月分まで書き戻して事故らないように、UI から編集不可にする。
  const { since, until } = useMemo(() => operatingMonthRange(month), [month]);
  const [sync, setSync] = useState<SyncState>({ status: "idle" });
  const [writeback, setWriteback] = useState<WritebackState>({ status: "idle" });
  // 「N 社でエラー」チップを押した時に、詳細リストを展開表示するかのフラグ。
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);

  // 「同期済み」の値を効かせる対象。loading 中もキャッシュ表示を維持したいので
  // success と loading.previous の両方を見る。
  const activeSuccess: SyncSuccess | null = useMemo(() => {
    if (sync.status === "success") return sync;
    if (sync.status === "loading" && sync.previous) return sync.previous;
    if (sync.status === "error" && sync.previous) return sync.previous;
    return null;
  }, [sync]);

  const syncMap = useMemo(() => {
    if (!activeSuccess) return new Map<string, number>();
    // results が配列でないキャッシュ (破損 or 旧形式) を踏んでも落ちないように防御。
    const results = Array.isArray(activeSuccess.results)
      ? activeSuccess.results
      : [];
    const m = new Map<string, number>();
    results.forEach((r) => {
      if (!r.error) m.set(r.clientKey, r.spend);
    });
    return m;
  }, [activeSuccess]);

  // handleSync を useCallback にしないと、下の useEffect(オートリフレッシュ) の
  // dep 配列がキャプチャする値がずれる。since/until は日付ピッカーで変わり得るので
  // deps に入れる。
  const handleSync = useCallback(
    async (opts?: { silent?: boolean }) => {
      setSync((prev) => {
        // silent (自動リフレッシュ) 時は既存表示を残して裏で読み直す。
        // 手動同期時は「同期中...」ボタン表示に切り替わる (previous を渡さない)。
        const previous =
          prev.status === "success"
            ? prev
            : prev.status === "loading"
              ? prev.previous
              : prev.status === "error"
                ? prev.previous
                : undefined;
        return { status: "loading", previous };
      });
      try {
        const params = new URLSearchParams({ since, until, month });
        const res = await fetch(`/api/meta-ads-sync?${params.toString()}`);
        if (!res.ok) {
          const err = (await res
            .json()
            .catch(() => ({ error: "Unknown" }))) as {
            error?: string;
          };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          matched: number;
          total: number;
          totalSpend: number;
          errorCount: number;
          results: SyncResult[];
          since: string;
          until: string;
        };
        const success: SyncSuccess = {
          status: "success",
          results: data.results,
          matched: data.matched,
          total: data.total,
          totalSpend: data.totalSpend,
          errorCount: data.errorCount,
          since: data.since,
          until: data.until,
          syncedAt: new Date().toISOString(),
        };
        setSync(success);
        // 月ごとにキャッシュ。次回開いた瞬間からこの値を出す。
        const cache = loadSyncCache();
        cache[month] = success;
        persistSyncCache(cache);

        // Meta 値をシートの S 列 (adSpend) に書き戻す。
        // 対応する行が rows に見つかった Meta 結果だけを送る (subscriberId が必要)。
        // シート更新は非同期で背景実行し、成功/失敗はステータス表示に反映する。
        const items = success.results
          .filter((r) => !r.error)
          .map((r) => {
            const row = rows.find((x) => x.id === r.clientKey);
            const sid = row?.subscriberId?.trim();
            if (!sid) return null;
            return {
              subscriberId: sid,
              field: "adSpend",
              value: Math.round(r.spend),
            };
          })
          .filter((v): v is NonNullable<typeof v> => v != null);
        if (items.length > 0) {
          setWriteback({ status: "writing", count: items.length });
          try {
            const wbRes = await fetch("/api/invoices/update-batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ month, items }),
            });
            const wbData = (await wbRes.json().catch(() => ({}))) as {
              updated?: number;
              missing?: string[];
              error?: string;
            };
            if (!wbRes.ok || wbData.error) {
              setWriteback({
                status: "error",
                message: wbData.error ?? `HTTP ${wbRes.status}`,
              });
            } else {
              setWriteback({
                status: "done",
                updated: wbData.updated ?? 0,
                missing: wbData.missing?.length ?? 0,
                at: new Date().toISOString(),
              });
            }
          } catch (wbErr) {
            setWriteback({
              status: "error",
              message:
                wbErr instanceof Error ? wbErr.message : "書き戻しに失敗しました",
            });
          }
        }
      } catch (err) {
        setSync((prev) => ({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
          previous:
            prev.status === "loading" ? prev.previous : undefined,
        }));
        // silent モードでエラーになってもトーストなどは出さない。
        // 前回のキャッシュがそのまま表示されているので、ユーザーが気づいたら
        // 手動で押し直せば良い。
        if (!opts?.silent) {
          // no-op: error 状態が既に UI に出るので追加処理不要
        }
      }
    },
    [since, until, month, rows],
  );

  // マウント時にキャッシュから前回結果を復元し、古ければ裏でリフレッシュする。
  // 月切り替え (props の month 変化) 時にも再走。
  useEffect(() => {
    const cache = loadSyncCache();
    const cached = cache[month];
    if (cached) {
      setSync(cached);
      const age = Date.now() - new Date(cached.syncedAt).getTime();
      if (age > AUTO_REFRESH_THRESHOLD_MS) {
        void handleSync({ silent: true });
      }
    } else {
      // 初めて開く月はキャッシュがない → 自動同期を裏で走らせる。
      void handleSync({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const marketers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.marketer) set.add(r.marketer);
    });
    return Array.from(set).sort();
  }, [rows]);

  const { overrides: orderOverrides, setAfter, remove: removeOverride } =
    useOrderOverrides();
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => {
      if (marketer !== "all" && r.marketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = `${r.clientName} ${r.subscriberId ?? ""}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    return applyOrderOverrides(base, orderOverrides);
  }, [rows, q, marketer, orderOverrides]);

  // Meta同期済みの行はその値を優先、未同期の行はシートの値を使う
  const effectiveSpend = (r: SheetInvoice): number => {
    const synced = syncMap.get(r.id);
    if (synced !== undefined) return synced;
    return r.adSpend ?? 0;
  };

  // 列コピー: フィルタ後の順序をそのまま縦一列でクリップボードに載せる。
  // スプレッドシートに貼り付けると各行が別セルに入る。
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyColumn = async (
    values: Array<string | number | null | undefined>,
    label: string,
  ) => {
    const text = values
      .map((v) => (v == null || v === "" ? "" : String(v)))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyToast(`${label} を ${values.length} 件コピーしました`);
    } catch {
      setCopyToast("コピーに失敗しました（HTTPSまたは権限を確認）");
    }
    setTimeout(() => setCopyToast(null), 2500);
  };

  // ヘッダーの列名の右に置く小さなコピーアイコンボタン
  const HeaderCopyButton = ({
    onClick,
    title,
  }: {
    onClick: () => void;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-slate-400 hover:text-brand-700 transition-colors ml-1 align-middle"
      title={title}
    >
      <Copy className="w-3 h-3 inline" />
    </button>
  );

  const totals = filtered.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + effectiveSpend(r),
      minAmount: acc.minAmount + (r.minAmount ?? 0),
      feeExTax: acc.feeExTax + (r.operationFeeExTax ?? 0),
      feeIncTax: acc.feeIncTax + (r.operationFeeIncTax ?? 0),
    }),
    { adSpend: 0, minAmount: 0, feeExTax: 0, feeIncTax: 0 },
  );
  const avgMargin =
    totals.adSpend > 0 ? totals.feeIncTax / totals.adSpend : 0;

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        title="運用代行売上"
        subtitle={`${monthTitle(month)} · クライアント別の広告費・運用代行費 (${filtered.length} 社表示)`}
      />
      <div className="shrink-0 px-6 pt-4 pb-3 space-y-3">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-2">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN </code>
            を Vercel の環境変数に登録すると、シート列R〜V（広告費・下限額・運用代行税抜/税込）が反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-2">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
          </div>
        )}

        {/* シート名の不一致警告: GAS が「アクティブシート」を返してしまった時に検知 */}
        {configured && sheetName && sheetMatched === false && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-900 text-xs px-4 py-3 space-y-1">
            <div className="font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              シートタブ名が一致していません（フォールバックが発動中）
            </div>
            <div className="leading-relaxed">
              GAS が返したタブ:
              <code className="font-mono ml-1 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                {sheetName}
              </code>
            </div>
            <div className="leading-relaxed">
              期待するタブ名（{monthLabel(month)}分・いずれか一致すればOK）:
              {expectedSheets && (
                <span className="ml-1">
                  {expectedSheets.map((name, i) => (
                    <code
                      key={i}
                      className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 ml-1 mt-1 inline-block"
                    >
                      {name}
                    </code>
                  ))}
                </span>
              )}
            </div>
            <div className="text-[11px] text-rose-700">
              対処: スプレッドシートのタブ名を上のいずれかに揃えてください。半角/全角の括弧や数字、余分な空白が原因の可能性が高いです。
            </div>
          </div>
        )}
        {configured && sheetName && sheetMatched && (
          <div className="text-[11px] text-slate-500 px-1">
            接続中のタブ:
            <code className="font-mono ml-1 text-slate-600">{sheetName}</code>
          </div>
        )}

        {/* 1段目: コンパクトなKPIタイル4枚 (色分けで役割を可視化) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            size="sm"
            accent="warning"
            label="総広告費"
            value={yen(totals.adSpend)}
            icon={<Megaphone className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="brand"
            label="総運用代行 (税抜)"
            value={yen(totals.feeExTax)}
            icon={<Coins className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="primary"
            label="総運用代行 (税込)"
            value={yen(totals.feeIncTax)}
            icon={<Coins className="w-4 h-4" />}
          />
          <StatCard
            size="sm"
            accent="success"
            label="平均マージン率"
            value={pct(avgMargin, 1)}
            icon={<Percent className="w-4 h-4" />}
          />
        </div>

        {/* Meta 広告費同期バー
            期間は表示月の稼働月に固定 (8月請求 → 7/1〜7/31)。
            別月の値を誤って書き戻すのを防ぐため、UI から編集不可。 */}
        <div className="card p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Zap className="w-4 h-4 text-brand-600" />
              Meta 広告費同期
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-1.5 tabular-nums">
              <span className="text-slate-500">稼働月固定</span>
              <span className="font-medium">
                {since.replace(/-/g, "/")} 〜 {until.replace(/-/g, "/")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSync()}
              disabled={sync.status === "loading"}
              className="btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
            >
              <RefreshCw
                className={`w-3 h-3 ${sync.status === "loading" ? "animate-spin" : ""}`}
              />
              {sync.status === "loading" ? "同期中..." : "Meta同期"}
            </button>
          </div>

          {/* success 表示は "現在の sync" が success の時だけでなく、
              loading/error の裏にキャッシュされている previous がある時も出す。
              「開いた瞬間に前回の値が見える + 最終同期時刻」を実現するため。 */}
          {activeSuccess && (
            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-emerald-700 font-medium">
                  ✓ 最終同期: {formatSyncedAt(activeSuccess.syncedAt)}
                </span>
                <span className="text-slate-500">
                  期間 {activeSuccess.since} 〜 {activeSuccess.until}
                </span>
                <span>
                  対象 {activeSuccess.matched} 社 / 合計 {yen(activeSuccess.totalSpend)}
                </span>
                {activeSuccess.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setErrorDetailsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 hover:underline"
                    title="クリックで詳細を表示"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {activeSuccess.errorCount} 社でエラー
                    <span className="text-[10px] text-amber-600">
                      {errorDetailsOpen ? "▲ 閉じる" : "▼ 詳細"}
                    </span>
                  </button>
                )}
                {sync.status === "loading" && (
                  <span className="text-slate-400">最新に更新中...</span>
                )}
              </div>
              {/* エラーになったクライアントの一覧。上の「N 社でエラー」を押した時だけ表示。
                  Meta の広告アカウントに広告費が無い月は Insight API が空を返し、
                  ここでは「no ads」的なメッセージが並ぶことが多い。 */}
              {errorDetailsOpen && activeSuccess.errorCount > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 space-y-1">
                  <div className="text-[11px] text-amber-800 font-medium">
                    Meta から広告費が取得できなかったクライアント (
                    {activeSuccess.errorCount} 社):
                  </div>
                  <ul className="space-y-0.5">
                    {(Array.isArray(activeSuccess.results)
                      ? activeSuccess.results
                      : []
                    )
                      .filter((r) => r.error)
                      .map((r) => (
                        <li
                          key={r.clientKey}
                          className="flex flex-wrap items-baseline gap-x-2 text-[11px]"
                        >
                          <span className="font-medium text-slate-800">
                            {r.clientName || r.clientKey}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {r.adAccountId}
                          </span>
                          <span className="text-amber-700">— {r.error}</span>
                        </li>
                      ))}
                  </ul>
                  <div className="text-[10px] text-slate-500 pt-1">
                    ※ 期間内に広告費が発生していない場合や、広告アカウントが停止している場合にもここに表示されます。
                  </div>
                </div>
              )}
            </div>
          )}

          {sync.status === "error" && (
            <div className="text-xs text-rose-700 flex items-start gap-2 border-t border-slate-100 pt-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">同期に失敗しました</div>
                <div className="text-rose-600 mt-0.5">{sync.message}</div>
                {sync.previous && (
                  <div className="text-slate-500 mt-0.5">
                    表示中の値は前回同期 ({formatSyncedAt(sync.previous.syncedAt)}) のキャッシュです
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta → シート S 列の書き戻し状態。同期成功直後に表示。 */}
          {writeback.status === "writing" && (
            <div className="text-xs text-slate-500 flex items-center gap-2 border-t border-slate-100 pt-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              シートへ広告費を書き戻し中... ({writeback.count} 社)
            </div>
          )}
          {writeback.status === "done" && (
            <div className="text-xs text-emerald-700 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
              <span className="font-medium">
                ✓ シート S 列に反映しました ({writeback.updated} 社更新)
              </span>
              {writeback.missing > 0 && (
                <span className="text-amber-700">
                  {writeback.missing} 社は識別番号がシートに見つからずスキップ
                </span>
              )}
            </div>
          )}
          {writeback.status === "error" && (
            <div className="text-xs text-rose-700 flex items-start gap-2 border-t border-slate-100 pt-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">シート書き戻しに失敗しました</div>
                <div className="text-rose-600 mt-0.5">{writeback.message}</div>
                <div className="text-slate-500 mt-0.5">
                  GAS の doPost に adSpend 書き込み対応が反映されていない可能性があります (新しいバージョンでデプロイし直してください)。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 検索 + フィルタ + 月ピッカー */}
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 識別番号で検索"
              className="input pl-9"
            />
          </div>
          {marketers.length > 0 && (
            <>
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={marketer}
                onChange={(e) => setMarketer(e.target.value)}
                className="input w-auto"
              >
                <option value="all">担当すべて</option>
                {marketers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">月表示</span>
            <MonthPicker current={month} />
          </div>
        </div>
      </div>
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-md shadow-lg">
          {copyToast}
        </div>
      )}
      {reorderTarget && (
        <ReorderDialog
          sourceName={reorderTarget}
          allClientNames={rows.map((r) => r.clientName)}
          currentTarget={orderOverrides[reorderTarget] ?? ""}
          onSave={(target) => {
            setAfter(reorderTarget, target);
            setReorderTarget(null);
          }}
          onClear={() => {
            removeOverride(reorderTarget);
            setReorderTarget(null);
          }}
          onCancel={() => setReorderTarget(null)}
        />
      )}
      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="card h-full flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide shadow-sm">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-slate-50 z-30 min-w-[180px]">
                    サロン名
                    <HeaderCopyButton
                      title="サロン名を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.clientName),
                          "サロン名",
                        )
                      }
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">
                    加入者識別番号
                    <HeaderCopyButton
                      title="加入者識別番号を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.subscriberId ?? ""),
                          "加入者識別番号",
                        )
                      }
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-3">別の広告費URL</th>
                  <th className="text-right font-medium px-4 py-3">
                    広告費
                    <HeaderCopyButton
                      title="広告費を縦一列でコピー（同期済みはMeta値を優先）"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => {
                            const s = syncMap.get(r.id);
                            if (s !== undefined) return s;
                            return r.adSpend ?? "";
                          }),
                          "広告費",
                        )
                      }
                    />
                  </th>
                  <th className="text-right font-medium px-4 py-3">下限額</th>
                  <th className="text-right font-medium px-4 py-3">
                    運用代行 (税抜)
                    <HeaderCopyButton
                      title="運用代行 (税抜) を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.operationFeeExTax ?? ""),
                          "運用代行(税抜)",
                        )
                      }
                    />
                  </th>
                  <th className="text-right font-medium px-4 py-3">
                    運用代行 (税込)
                    <HeaderCopyButton
                      title="運用代行 (税込) を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.operationFeeIncTax ?? ""),
                          "運用代行(税込)",
                        )
                      }
                    />
                  </th>
                  <th className="text-right font-medium px-4 py-3">マージン率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const syncedSpend = syncMap.get(r.id);
                  const displaySpend =
                    syncedSpend !== undefined ? syncedSpend : r.adSpend;
                  const margin =
                    displaySpend && displaySpend > 0 && r.operationFeeIncTax
                      ? r.operationFeeIncTax / displaySpend
                      : null;
                  const syncedError =
                    sync.status === "success" &&
                    Array.isArray(sync.results)
                      ? sync.results.find((x) => x.clientKey === r.id)?.error
                      : undefined;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-1">
                          {r.clientId ? (
                            <Link
                              href={`/clients/${r.clientId}`}
                              className="font-medium hover:text-brand-700"
                            >
                              {r.clientName}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.clientName}</span>
                          )}
                          <button
                            onClick={() => setReorderTarget(r.clientName)}
                            className={`p-0.5 rounded ${
                              orderOverrides[r.clientName]
                                ? "text-brand-600"
                                : "text-slate-300 hover:text-brand-700"
                            }`}
                            title={
                              orderOverrides[r.clientName]
                                ? `並び順オーバーライド中: 「${orderOverrides[r.clientName]}」の直後`
                                : "並び順を調整"
                            }
                          >
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.marketer ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.otherAdSpendUrl ? (
                          <a
                            href={r.otherAdSpendUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs"
                          >
                            開く <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums"
                        title={syncedError ?? undefined}
                      >
                        {displaySpend != null ? (
                          <span className="inline-flex items-center gap-1">
                            {syncedSpend !== undefined && (
                              <Zap
                                className="w-3 h-3 text-brand-500"
                                aria-label="Meta同期済み"
                              />
                            )}
                            {yen(displaySpend)}
                          </span>
                        ) : syncedError ? (
                          <span className="inline-flex items-center gap-1 text-rose-500 text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            error
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {r.minAmount != null ? yen(r.minAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.operationFeeExTax != null
                          ? yen(r.operationFeeExTax)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {r.operationFeeIncTax != null
                          ? yen(r.operationFeeIncTax)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-emerald-700">
                        {margin != null ? pct(margin, 1) : "—"}
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
