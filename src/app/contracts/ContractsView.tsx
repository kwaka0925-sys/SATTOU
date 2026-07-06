"use client";

import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import {
  ExternalLink,
  FileSignature,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { ContractClient } from "./page";

const STORAGE_KEY = "sattou-contracts";

type Contract = {
  id: string;
  clientName: string;
  subscriberId: string;
  contractUrl: string;
  note: string;
  createdAt: string;
};

type Props = {
  clients: ContractClient[];
  configured: boolean;
};

function newId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `c-${Date.now().toString(36)}-${rand}`;
}

export default function ContractsView({ clients, configured }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [formClientName, setFormClientName] = useState("");
  const [formSubscriberId, setFormSubscriberId] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formNote, setFormNote] = useState("");

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setContracts(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const persist = (next: Contract[]) => {
    setContracts(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const resetForm = () => {
    setFormClientName("");
    setFormSubscriberId("");
    setFormUrl("");
    setFormNote("");
    setPickerQuery("");
    setPickerOpen(false);
    setEditingId(null);
    setShowForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (c: Contract) => {
    setFormClientName(c.clientName);
    setFormSubscriberId(c.subscriberId);
    setFormUrl(c.contractUrl);
    setFormNote(c.note);
    setEditingId(c.id);
    setShowForm(true);
    setPickerOpen(false);
    setPickerQuery("");
  };

  const saveContract = () => {
    const clientName = formClientName.trim();
    const url = formUrl.trim();
    if (!clientName || !url) return;
    const now = new Date().toISOString();
    const existing = editingId
      ? contracts.find((c) => c.id === editingId)
      : undefined;
    const record: Contract = {
      id: editingId ?? newId(),
      clientName,
      subscriberId: formSubscriberId.trim(),
      contractUrl: url,
      note: formNote.trim(),
      createdAt: existing?.createdAt ?? now,
    };
    const next = editingId
      ? contracts.map((c) => (c.id === editingId ? record : c))
      : [record, ...contracts];
    persist(next);
    resetForm();
  };

  const deleteContract = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("この契約書を削除しますか？")) {
      return;
    }
    persist(contracts.filter((c) => c.id !== id));
  };

  const selectClient = (c: ContractClient) => {
    setFormClientName(c.clientName);
    setFormSubscriberId(c.subscriberId);
    setPickerOpen(false);
    setPickerQuery("");
  };

  // Auto-fill client name when the operator types an existing subscriber ID.
  const handleSubscriberIdChange = (value: string) => {
    setFormSubscriberId(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const match = clients.find((c) => c.subscriberId.trim() === trimmed);
    if (match) {
      setFormClientName(match.clientName);
    }
  };

  // Auto-fill subscriber ID when the operator types a client name that
  // matches one of the current sheet rows.
  const handleClientNameChange = (value: string) => {
    setFormClientName(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const match = clients.find(
      (c) => c.clientName.trim() === trimmed && c.subscriberId,
    );
    if (match) {
      setFormSubscriberId(match.subscriberId);
    }
  };

  const pickerResults = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    const source = query
      ? clients.filter((c) => {
          const hay = `${c.clientName} ${c.subscriberId}`.toLowerCase();
          return hay.includes(query);
        })
      : clients;
    return source.slice(0, 40);
  }, [clients, pickerQuery]);

  const filteredContracts = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((c) => {
      const hay = `${c.clientName} ${c.subscriberId}`.toLowerCase();
      return hay.includes(query);
    });
  }, [contracts, q]);

  return (
    <div>
      <TopBar
        title="契約書関連"
        subtitle={`登録済み ${contracts.length} 件 · 表示 ${filteredContracts.length} 件`}
      />
      <div className="p-6 space-y-4">
        {/* Search + Add */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="サロン名 / 加入者識別番号で検索"
              className="input pl-9"
            />
          </div>
          <button
            onClick={startAdd}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新規登録
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-brand-600" />
                {editingId ? "契約書を編集" : "新規契約書を登録"}
              </h2>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-700 block">
                クライアント <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={formClientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  placeholder="サロン名"
                  list="contract-clientname-suggestions"
                  className="input flex-1 min-w-[220px]"
                />
                <input
                  value={formSubscriberId}
                  onChange={(e) => handleSubscriberIdChange(e.target.value)}
                  placeholder="加入者識別番号"
                  list="contract-subscriberid-suggestions"
                  className="input w-40"
                />
                <datalist id="contract-clientname-suggestions">
                  {clients.map((c, i) => (
                    <option
                      key={`name-${i}`}
                      value={c.clientName}
                    >
                      {c.subscriberId ? `加入者ID: ${c.subscriberId}` : ""}
                    </option>
                  ))}
                </datalist>
                <datalist id="contract-subscriberid-suggestions">
                  {clients
                    .filter((c) => c.subscriberId)
                    .map((c, i) => (
                      <option key={`id-${i}`} value={c.subscriberId}>
                        {c.clientName}
                      </option>
                    ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="btn-ghost inline-flex items-center gap-1"
                >
                  <Search className="w-4 h-4" />
                  {pickerOpen ? "閉じる" : "一覧から選択"}
                </button>
              </div>

              {pickerOpen && (
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="p-3 border-b border-slate-200">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        autoFocus
                        value={pickerQuery}
                        onChange={(e) => setPickerQuery(e.target.value)}
                        placeholder="サロン名 / 加入者識別番号で絞り込み"
                        className="input pl-9"
                      />
                    </div>
                    {!configured && (
                      <div className="text-xs text-amber-700 mt-2">
                        請求書シートに未接続のため候補が出ません。上のフォームに手入力してください。
                      </div>
                    )}
                    {configured && clients.length === 0 && (
                      <div className="text-xs text-slate-500 mt-2">
                        今月分の請求書データが取得できませんでした。
                      </div>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {pickerResults.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        該当するクライアントが見つかりません
                      </div>
                    )}
                    {pickerResults.map((c, i) => (
                      <button
                        key={`${c.subscriberId}-${c.clientName}-${i}`}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {c.clientName}
                          </div>
                          <div className="text-xs text-slate-500">
                            加入者ID: {c.subscriberId || "—"}
                          </div>
                        </div>
                        <span className="text-xs text-brand-700">選択</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-700 block">
                契約書URL <span className="text-rose-500">*</span>
              </label>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-700 block">メモ</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="契約内容や締結日など（任意）"
                className="input min-h-[80px]"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="btn-ghost">
                キャンセル
              </button>
              <button
                onClick={saveContract}
                disabled={!formClientName.trim() || !formUrl.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "更新" : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Contracts list */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">サロン名</th>
                  <th className="text-left font-medium px-4 py-3">加入者識別番号</th>
                  <th className="text-left font-medium px-4 py-3">契約書</th>
                  <th className="text-left font-medium px-4 py-3">メモ</th>
                  <th className="text-left font-medium px-4 py-3">登録日</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      {contracts.length === 0
                        ? "契約書はまだ登録されていません。上の「新規登録」から追加してください。"
                        : "該当する契約書が見つかりませんでした。"}
                    </td>
                  </tr>
                )}
                {filteredContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{c.clientName}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.subscriberId || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={c.contractUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline text-xs max-w-[280px] truncate"
                        title={c.contractUrl}
                      >
                        契約書を開く <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-500 max-w-[220px] truncate"
                      title={c.note}
                    >
                      {c.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-brand-700 hover:underline text-xs mr-3"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteContract(c.id)}
                        className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        削除
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
