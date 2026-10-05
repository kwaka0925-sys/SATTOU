// 同一グループの関連クライアント（例: 桜ヶ丘整骨院 とその系列店 レリーフ整骨院）を
// 一覧上で隣接させたいときの、行単位の並び順オーバーライド。
// クライアント名 (clientName) をキーに、直後に配置したい別クライアント名を値として持つ。
// /clients と /ads で同じ localStorage キーを共有する。

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sattou-row-order-overrides";

export type OrderOverrides = Record<string, string>; // 移動元 clientName -> 配置先 clientName

function loadFromStorage(): OrderOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const clean: OrderOverrides = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") clean[k] = v;
      }
      return clean;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveToStorage(overrides: OrderOverrides) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore quota
  }
}

export function useOrderOverrides() {
  const [overrides, setOverrides] = useState<OrderOverrides>({});

  useEffect(() => {
    setOverrides(loadFromStorage());
  }, []);

  const setAfter = useCallback((sourceName: string, targetName: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [sourceName]: targetName };
      saveToStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((sourceName: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[sourceName];
      saveToStorage(next);
      return next;
    });
  }, []);

  return { overrides, setAfter, remove };
}

// 行を並び替える: overrides で指定されたキーの行を、配置先の直後に移動する。
// 同じ配置先に複数の行が指定された場合は、元の順序を保った並びで挿入される。
export function applyOrderOverrides<T extends { clientName: string }>(
  rows: T[],
  overrides: OrderOverrides,
): T[] {
  if (Object.keys(overrides).length === 0) return rows;

  const overriddenNames = new Set(Object.keys(overrides));
  // ベース: オーバーライドされていない行のみ (元の順序を保つ)
  const base: T[] = rows.filter((r) => !overriddenNames.has(r.clientName));
  // 移動対象: 元の順序を保つ
  const toMove: T[] = rows.filter((r) => overriddenNames.has(r.clientName));

  const result: T[] = [...base];

  // 全てのオーバーライドを一度処理。もし配置先が見つからなければ末尾に置く。
  toMove.forEach((row) => {
    const targetName = overrides[row.clientName];
    const targetIdx = result.findIndex((r) => r.clientName === targetName);
    if (targetIdx >= 0) {
      result.splice(targetIdx + 1, 0, row);
    } else {
      result.push(row);
    }
  });

  return result;
}
