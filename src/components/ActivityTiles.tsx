"use client";

import { useEffect, useState } from "react";
import { Sparkles, Store, UserX } from "lucide-react";
import { num } from "@/lib/format";
import StatCard from "./StatCard";

type Props = {
  month: string; // YYYY-MM
  cancelledCountFromSheet: number;
};

type DatedRecord = { installDate?: string };

function countForMonth(key: string, month: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return 0;
    return list.filter((r: DatedRecord) =>
      typeof r?.installDate === "string" && r.installDate.startsWith(month),
    ).length;
  } catch {
    return 0;
  }
}

function cancelledCountLocal(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem("sattou-cancelled-stores");
    if (!raw) return 0;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

export default function ActivityTiles({ month, cancelledCountFromSheet }: Props) {
  const [newCount, setNewCount] = useState<number>(0);
  const [addCount, setAddCount] = useState<number>(0);
  const [cancelLocal, setCancelLocal] = useState<number>(0);

  useEffect(() => {
    setNewCount(countForMonth("sattou-new-registrations", month));
    setAddCount(countForMonth("sattou-store-additions", month));
    setCancelLocal(cancelledCountLocal());
  }, [month]);

  // 解約数はシート側の集計（当月）が0のときはローカル累計に補完的にフォールバック
  const cancelled = cancelledCountFromSheet || cancelLocal;
  const cancelledHint =
    cancelledCountFromSheet > 0
      ? "当月シート集計"
      : cancelLocal > 0
      ? "累計（sattou導入店舗ローカル）"
      : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        size="sm"
        accent="success"
        label="新規契約数"
        value={`${num(newCount)} 件`}
        icon={<Sparkles className="w-4 h-4" />}
        hint="新規登録（当月導入日）"
      />
      <StatCard
        size="sm"
        accent="info"
        label="店舗追加数"
        value={`${num(addCount)} 件`}
        icon={<Store className="w-4 h-4" />}
        hint="店舗追加（当月導入日）"
      />
      <StatCard
        size="sm"
        accent="danger"
        label="解約数"
        value={`${num(cancelled)} 件`}
        icon={<UserX className="w-4 h-4" />}
        hint={cancelledHint}
      />
    </div>
  );
}
