"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";

type Props = {
  /** 並び替えたい対象のクライアント名 */
  sourceName: string;
  /** 一覧に存在する全クライアント名 (自身は除外して選ばせる) */
  allClientNames: string[];
  /** 現在設定されている「配置先」クライアント名 (未設定なら空文字) */
  currentTarget: string;
  onSave: (targetName: string) => void;
  onClear: () => void;
  onCancel: () => void;
};

export default function ReorderDialog({
  sourceName,
  allClientNames,
  currentTarget,
  onSave,
  onClear,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState(currentTarget);
  const [q, setQ] = useState("");

  const options = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return allClientNames
      .filter((n) => n && n !== sourceName)
      .filter((n) => (qq ? n.toLowerCase().includes(qq) : true));
  }, [allClientNames, sourceName, q]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-brand-600" />
          並び順を調整
        </h3>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-slate-500">移動する行: </span>
            <strong>{sourceName}</strong>
          </div>
          <div className="text-xs text-slate-500">
            選択したクライアントの<strong>直後</strong>に配置されます。
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="配置先のクライアント名で検索"
            className="input pl-9"
          />
        </div>

        <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              該当するクライアントが見つかりません
            </div>
          ) : (
            options.map((n) => (
              <label
                key={n}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  selected === n ? "bg-brand-50" : ""
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  value={n}
                  checked={selected === n}
                  onChange={() => setSelected(n)}
                  className="shrink-0"
                />
                <span className="truncate">{n}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {currentTarget && (
            <button
              onClick={onClear}
              className="btn-ghost text-xs text-rose-600 hover:text-rose-700"
            >
              オーバーライドを解除
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onCancel} className="btn-ghost">
              キャンセル
            </button>
            <button
              onClick={() => selected && onSave(selected)}
              disabled={!selected}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
