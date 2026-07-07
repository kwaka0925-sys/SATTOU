"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { yen, num } from "@/lib/format";
import TopBar from "@/components/TopBar";
import MonthPicker from "@/components/MonthPicker";
import {
  AlertTriangle,
  ArrowUpDown,
  Copy,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import type { InvoicePaymentMethod } from "@/lib/types";
import type { SheetInvoice } from "@/lib/sheets";
import {
  applyOrderOverrides,
  useOrderOverrides,
} from "@/lib/rowOrderOverrides";
import ReorderDialog from "@/components/ReorderDialog";

const PROGRESS_VALUES = [
  "未発行",
  "発行済み",
  "送付済み",
  "入金確認済み",
  "入金未確認",
  "請求なし",
  "未払い",
  "金額が違う",
] as const;

type ProgressValue = "" | (typeof PROGRESS_VALUES)[number];

const PROGRESS_STYLE: Record<(typeof PROGRESS_VALUES)[number], string> = {
  未発行: "bg-slate-100 text-slate-600 border-slate-200",
  発行済み: "bg-sky-50 text-sky-700 border-sky-200",
  送付済み: "bg-indigo-50 text-indigo-700 border-indigo-200",
  入金確認済み: "bg-emerald-50 text-emerald-700 border-emerald-200",
  入金未確認: "bg-amber-50 text-amber-800 border-amber-200",
  請求なし: "bg-slate-100 text-slate-500 border-slate-200",
  未払い: "bg-orange-50 text-orange-700 border-orange-200",
  金額が違う: "bg-rose-100 text-rose-800 border-rose-300",
};

function progressCls(v: ProgressValue): string {
  if (!v) return "bg-white text-slate-500 border-slate-200";
  return PROGRESS_STYLE[v];
}

function isProgressValue(v: string): v is ProgressValue {
  return v === "" || (PROGRESS_VALUES as readonly string[]).includes(v);
}

const SUBSCRIPTION_OPTIONS = [
  "継続",
  "解約",
  "システムのみ",
  "システム＋マーケ",
  "マーケのみ",
  "トライアル",
];

const OVERRIDES_STORAGE_KEY = "sattou-invoice-overrides";

type EditableField =
  | "paymentMethod"
  | "progress"
  | "subscriptionStatus"
  | "marketer"
  | "note";

type RowOverride = Partial<Record<EditableField, string>>;
type OverridesMap = Record<string, RowOverride>;

type PmFilter = "all" | InvoicePaymentMethod;
type ProgressFilter = "all" | ProgressValue;

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

export default function ClientsView({
  rows,
  month,
  configured,
  isMock,
  sheetName,
  expectedSheets,
  sheetMatched,
}: Props) {
  const [q, setQ] = useState("");
  const [pm, setPm] = useState<PmFilter>("all");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [marketer, setMarketer] = useState<string>("all");
  const [overrides, setOverrides] = useState<OverridesMap>({});

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
      // ignore parse errors
    }
  }, []);

  const persistOverrides = useCallback((next: OverridesMap) => {
    try {
      window.localStorage.setItem(
        OVERRIDES_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // ignore quota errors
    }
  }, []);

  // Sheet 側への双方向同期の状態管理。キーは `${subscriberId}:${field}`。
  //   saving = リクエスト送信中 (青いドット)
  //   error  = 直近の書き込みが失敗 (赤いドット)
  //   なし    = 同期済み or ローカルのみ (通常表示)
  type SyncStatus = "saving" | "error";
  const [syncState, setSyncState] = useState<Record<string, SyncStatus>>({});
  // note (テキスト入力) はキー打つたびに API を呼ばず、400ms 静止で送る。
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // syncField から呼ぶ router.refresh() を、宣言順序の都合上 ref 経由で参照する。
  // (hooks の順序を維持したまま useRouter の値を先に確定させる)
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // /api/invoices/update を叩いてシートのセルを更新する。
  // subscriberId が空の行 (加入者識別番号未設定) は同期スキップ。
  // 成功したらローカル override を削除し、シートを唯一の情報源にする
  // (シートが直接編集された場合に画面が古い値を掴み続ける事故を防ぐ)。
  const syncField = useCallback(
    async (
      id: string,
      subscriberId: string,
      field: EditableField,
      value: string,
    ) => {
      const key = `${subscriberId}:${field}`;
      setSyncState((prev) => ({ ...prev, [key]: "saving" }));
      try {
        const res = await fetch("/api/invoices/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, subscriberId, field, value }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setSyncState((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // シートへの反映が確定した。ここで override を即座に消すと、
        // 次の SSR 再取得が届く前に UI が古い r.<field> にフォールバックして
        // 値が「元に戻る」ように見えてしまう。override は残したまま
        // 別の useEffect で「新しい SSR 値と一致した時のみ」除去する。
        // 新しい SSR を早く取り込むために refresh は仕込んでおく (下の
        // useEffect(rows) が入れ替わりに override をクリアする)。
        if (routerRef.current) routerRef.current.refresh();
      } catch (err) {
        setSyncState((prev) => ({ ...prev, [key]: "error" }));
        showToast(
          `シートへの保存に失敗しました (${field}): ${
            err instanceof Error ? err.message : "不明なエラー"
          }。GAS の doPost が古い可能性があります。デプロイを再作成してください。`,
        );
      }
    },
    [month, persistOverrides, showToast],
  );

  const updateOverride = useCallback(
    (
      id: string,
      field: EditableField,
      value: string,
      subscriberId?: string | null,
    ) => {
      setOverrides((prev) => {
        const rowPrev = prev[id] ?? {};
        const rowNext: RowOverride = { ...rowPrev };
        if (value === "") {
          delete rowNext[field];
        } else {
          rowNext[field] = value;
        }
        const next: OverridesMap = { ...prev };
        if (Object.keys(rowNext).length === 0) {
          delete next[id];
        } else {
          next[id] = rowNext;
        }
        persistOverrides(next);
        return next;
      });

      // シートへの書き戻し。加入者識別番号がない行は同期スキップ (ローカルのみ)。
      const sid = subscriberId?.trim();
      if (!sid) return;
      const dkey = `${sid}:${field}`;
      // メモは連続入力するので debounce。ドロップダウンは即時送信。
      if (field === "note") {
        clearTimeout(debounceTimers.current[dkey]);
        debounceTimers.current[dkey] = setTimeout(() => {
          syncField(id, sid, field, value);
        }, 400);
      } else {
        syncField(id, sid, field, value);
      }
    },
    [persistOverrides, syncField],
  );

  // マウント時に登録した debounce timer をアンマウント時にクリア。
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // シートを直接編集した内容を sattou 側に反映するためのリフレッシュ。
  // Server Component (page.tsx) をサーバー側で再実行して最新シートを取り込む。
  // 上部で宣言済みの router を使う。
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    // 「シート更新」ボタンはシート側の直接編集を取り込む用途。
    // ローカル override は「未同期のユーザー入力」なので消さないが、
    // useEffect(rows) が incoming と一致した override を掃除する。
    router.refresh();
    setTimeout(() => setRefreshing(false), 1200);
  }, [router]);

  // 「別タブでシート編集 → sattou タブに戻る」を検知して自動再取得。
  // 常時ポーリングだと GAS を叩きすぎるので、フォーカスイベントのみに絞る。
  useEffect(() => {
    const onFocus = () => {
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  // 新しい SSR 行データが届くたびに、override の中で「もう sheet と同じ」
  // ものを掃除する。これで syncField 直後の router.refresh() が返ってきた
  // タイミングで override が透けて消え、次に外部でシートが編集されたときは
  // 新しい sheet 値がそのまま表示される。
  useEffect(() => {
    setOverrides((prev) => {
      let mutated = false;
      const next: OverridesMap = {};
      for (const [id, row] of Object.entries(prev)) {
        const sheetRow = rows.find((r) => r.id === id);
        if (!sheetRow) {
          next[id] = row;
          continue;
        }
        const kept: RowOverride = {};
        (Object.keys(row) as EditableField[]).forEach((field) => {
          const overrideVal = row[field] ?? "";
          const sheetVal =
            field === "paymentMethod"
              ? sheetRow.paymentMethod ?? ""
              : field === "progress"
                ? sheetRow.progress ?? ""
                : field === "subscriptionStatus"
                  ? sheetRow.subscriptionStatus ?? ""
                  : field === "marketer"
                    ? sheetRow.marketer ?? ""
                    : field === "note"
                      ? sheetRow.note ?? ""
                      : undefined;
          if (sheetVal === undefined || overrideVal !== sheetVal) {
            kept[field] = row[field];
          } else {
            mutated = true;
          }
        });
        if (Object.keys(kept).length > 0) next[id] = kept;
        else mutated = true;
      }
      if (!mutated) return prev;
      persistOverrides(next);
      return next;
    });
  }, [rows, persistOverrides]);

  // セル横に添える 3px の状態ドット。同期中は青、失敗は赤、通常は非表示。
  const SyncDot = ({
    subscriberId,
    field,
  }: {
    subscriberId?: string | null;
    field: EditableField;
  }) => {
    if (!subscriberId) return null;
    const status = syncState[`${subscriberId.trim()}:${field}`];
    if (!status) return null;
    return (
      <span
        aria-label={status === "saving" ? "保存中" : "保存に失敗しました"}
        title={status === "saving" ? "シートに保存中..." : "シート保存に失敗しました"}
        className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
          status === "saving" ? "bg-sky-400 animate-pulse" : "bg-rose-500"
        }`}
      />
    );
  };

  const effectivePaymentMethod = useCallback(
    (r: SheetInvoice): string => {
      const override = overrides[r.id]?.paymentMethod;
      if (override !== undefined) return override;
      return r.paymentMethod ?? "";
    },
    [overrides],
  );

  // Progress source of truth for each row:
  //   1. User override (localStorage)
  //   2. Sheet H column value if it is exactly "入金確認済み"
  //   3. Empty (all other cases default to blank)
  const effectiveProgress = useCallback(
    (r: SheetInvoice): ProgressValue => {
      const override = overrides[r.id]?.progress;
      if (override && isProgressValue(override)) return override;
      const sheetProgress = (r.progress ?? "").trim();
      if (sheetProgress === "入金確認済み") return "入金確認済み";
      return "";
    },
    [overrides],
  );

  const effectiveSubscription = useCallback(
    (r: SheetInvoice): string => {
      const override = overrides[r.id]?.subscriptionStatus;
      if (override !== undefined) return override;
      return r.subscriptionStatus ?? "";
    },
    [overrides],
  );

  const effectiveMarketer = useCallback(
    (r: SheetInvoice): string => {
      const override = overrides[r.id]?.marketer;
      if (override !== undefined) return override;
      return r.marketer ?? "";
    },
    [overrides],
  );

  const effectiveNote = useCallback(
    (r: SheetInvoice): string => {
      const override = overrides[r.id]?.note;
      if (override !== undefined) return override;
      return r.note ?? "";
    },
    [overrides],
  );

  const marketers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const m = effectiveMarketer(r);
      if (m) set.add(m);
    });
    return Array.from(set).sort();
  }, [rows, effectiveMarketer]);

  const subscriptionOptions = useMemo(() => {
    const set = new Set<string>(SUBSCRIPTION_OPTIONS);
    rows.forEach((r) => {
      const v = effectiveSubscription(r);
      if (v) set.add(v);
    });
    return Array.from(set);
  }, [rows, effectiveSubscription]);

  const { overrides: orderOverrides, setAfter, remove: removeOverride } =
    useOrderOverrides();
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => {
      const rowPm = effectivePaymentMethod(r);
      const rowProgress = effectiveProgress(r);
      const rowMarketer = effectiveMarketer(r);
      if (pm !== "all" && rowPm !== pm) return false;
      if (progressFilter !== "all" && rowProgress !== progressFilter) return false;
      if (marketer !== "all" && rowMarketer !== marketer) return false;
      if (q) {
        const qq = q.toLowerCase();
        const hay = [
          r.clientName,
          r.subscriberId ?? "",
          r.payeeName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
    return applyOrderOverrides(base, orderOverrides);
  }, [
    rows,
    pm,
    progressFilter,
    marketer,
    q,
    orderOverrides,
    effectivePaymentMethod,
    effectiveProgress,
    effectiveMarketer,
  ]);

  // 列コピー: フィルタ後の順序をそのまま縦一列でクリップボードに載せる。
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
    (acc, r) => {
      const rowPm = effectivePaymentMethod(r);
      const rowProgress = effectiveProgress(r);
      // 未入金は「請求書払い」の中で「入金確認済み」でない金額のみを集計。
      // 口座振替は運用上「入金確認済み」のステータス更新を行わないため、
      // 集計から完全に除外する。「請求なし」は請求自体が無いので同様に除外。
      const isInvoicePm = rowPm === "請求書";
      const isPaid = rowProgress === "入金確認済み";
      const isNoBill = rowProgress === "請求なし";
      const countsAsUnpaid = isInvoicePm && !isPaid && !isNoBill;
      return {
        brand: acc.brand + (r.brandCount ?? 0),
        store: acc.store + (r.storeCount ?? 0),
        amount: acc.amount + r.amount,
        unpaid: acc.unpaid + (countsAsUnpaid ? r.amount : 0),
      };
    },
    { brand: 0, store: 0, amount: 0, unpaid: 0 },
  );

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        title="請求書"
        subtitle={`${monthTitle(month)} · 全 ${rows.length} 社 / 表示 ${filtered.length} 社`}
      />
      <div className="shrink-0 p-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">月表示</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-700 border border-slate-200 rounded-md px-2 py-1 disabled:opacity-60"
              title="スプレッドシートを直接編集した内容を取り込むために手動再取得"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
              />
              シート更新
            </button>
            <MonthPicker current={month} />
          </div>
        </div>
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs px-4 py-3">
            GAS連携が未設定です。<code className="font-mono">SHEETS_GAS_URL</code> と
            <code className="font-mono"> SHEETS_GAS_TOKEN </code>
            を Vercel の環境変数に登録すると、請求書シートの実データがこの画面に反映されます。
          </div>
        )}
        {configured && rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            {monthLabel(month)}分のデータがシートに見つかりませんでした。
            <code className="font-mono">?month=YYYY-MM</code> で別の月を指定できます。
          </div>
        )}
        {configured && rows.length > 0 && totals.amount === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs px-4 py-3">
            接続中のシートに請求金額列（G列）のデータが見つかりません。<strong>請求書管理タブ</strong>とは別のタブ（例: sattou導入店舗）を読み込んでいる可能性があります。店舗一覧は <a href="/stores" className="underline text-brand-700">sattou導入店舗</a> に表示されます。
          </div>
        )}

        {/* シート名の不一致警告 */}
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
              対処: 上のいずれかのタブ名（推奨は末尾のもの）にスプレッドシートのタブ名を揃えてください。半角/全角の括弧や余分な空白が原因の可能性が高いです。
            </div>
          </div>
        )}
        {configured && sheetName && sheetMatched && (
          <div className="text-[11px] text-slate-500 px-1">
            接続中のタブ:
            <code className="font-mono ml-1 text-slate-600">{sheetName}</code>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-sm text-slate-500">総ブランド数</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.brand)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">総店舗数</div>
            <div className="text-2xl font-semibold mt-1">{num(totals.store)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">請求総額</div>
            <div className="text-2xl font-semibold mt-1">{yen(totals.amount)}</div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-slate-500">未入金</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">
              {yen(totals.unpaid)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              請求書払い · 入金確認済み以外
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 加入者識別番号 / 振込名で検索"
              className="input pl-9"
            />
          </div>
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={pm}
            onChange={(e) => setPm(e.target.value as PmFilter)}
            className="input w-auto"
          >
            <option value="all">支払方法すべて</option>
            <option value="振替">振替</option>
            <option value="請求書">請求書</option>
          </select>
          <select
            value={progressFilter}
            onChange={(e) => setProgressFilter(e.target.value as ProgressFilter)}
            className="input w-auto"
          >
            <option value="all">進捗確認すべて</option>
            <option value="">(未設定)</option>
            {PROGRESS_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {marketers.length > 0 && (
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
          )}
        </div>
      </div>
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-md shadow-lg">
          {copyToast}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-xs px-4 py-2 rounded-md shadow-lg max-w-md">
          {toast}
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
                  <th className="text-right font-medium px-4 py-3">
                    ブランド数
                    <HeaderCopyButton
                      title="ブランド数を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.brandCount ?? ""),
                          "ブランド数",
                        )
                      }
                    />
                  </th>
                  <th className="text-right font-medium px-4 py-3">
                    店舗数
                    <HeaderCopyButton
                      title="店舗数を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.storeCount ?? ""),
                          "店舗数",
                        )
                      }
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-3">振替 / 請求書</th>
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
                  <th className="text-left font-medium px-4 py-3">
                    振込名
                    <HeaderCopyButton
                      title="振込名を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.payeeName ?? ""),
                          "振込名",
                        )
                      }
                    />
                  </th>
                  <th className="text-right font-medium px-4 py-3">
                    請求金額 (税込)
                    <HeaderCopyButton
                      title="請求金額 (税込) を縦一列でコピー"
                      onClick={() =>
                        copyColumn(
                          filtered.map((r) => r.amount ?? ""),
                          "請求金額(税込)",
                        )
                      }
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-3">進捗確認</th>
                  <th className="text-left font-medium px-4 py-3">口座振替進捗</th>
                  <th className="text-left font-medium px-4 py-3">継続</th>
                  <th className="text-left font-medium px-4 py-3">担当</th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const rowPm = effectivePaymentMethod(r);
                  const rowProgress = effectiveProgress(r);
                  const rowSub = effectiveSubscription(r);
                  const rowMarketer = effectiveMarketer(r);
                  const rowNote = effectiveNote(r);
                  const pmCls =
                    rowPm === "振替"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : rowPm === "請求書"
                      ? "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-white text-slate-500 border-slate-200";
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.brandCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.storeCount ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={rowPm}
                          onChange={(e) =>
                            updateOverride(
                              r.id,
                              "paymentMethod",
                              e.target.value,
                              r.subscriberId,
                            )
                          }
                          className={`text-xs rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 ${pmCls}`}
                        >
                          <option value="">—</option>
                          <option value="振替">口座振替</option>
                          <option value="請求書">請求書</option>
                        </select>
                        <SyncDot
                          subscriberId={r.subscriberId}
                          field="paymentMethod"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.subscriberId ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.payeeName ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {yen(r.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={rowProgress}
                          onChange={(e) =>
                            updateOverride(
                              r.id,
                              "progress",
                              e.target.value,
                              r.subscriberId,
                            )
                          }
                          className={`text-xs rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 ${progressCls(rowProgress)}`}
                        >
                          <option value="">—</option>
                          {PROGRESS_VALUES.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <SyncDot subscriberId={r.subscriberId} field="progress" />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.bankTransferProgress ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={rowSub}
                          onChange={(e) =>
                            updateOverride(
                              r.id,
                              "subscriptionStatus",
                              e.target.value,
                              r.subscriberId,
                            )
                          }
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        >
                          <option value="">—</option>
                          {subscriptionOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <SyncDot
                          subscriberId={r.subscriberId}
                          field="subscriptionStatus"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={rowMarketer}
                          onChange={(e) =>
                            updateOverride(
                              r.id,
                              "marketer",
                              e.target.value,
                              r.subscriberId,
                            )
                          }
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        >
                          <option value="">—</option>
                          {marketers.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          {rowMarketer &&
                            !marketers.includes(rowMarketer) && (
                              <option value={rowMarketer}>{rowMarketer}</option>
                            )}
                        </select>
                        <SyncDot subscriberId={r.subscriberId} field="marketer" />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={rowNote}
                          onChange={(e) =>
                            updateOverride(
                              r.id,
                              "note",
                              e.target.value,
                              r.subscriberId,
                            )
                          }
                          placeholder="メモを入力"
                          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        />
                        <SyncDot subscriberId={r.subscriberId} field="note" />
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
