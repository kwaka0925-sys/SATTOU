"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar } from "lucide-react";

type Props = {
  current: string;
  monthsBack?: number;
  monthsForward?: number;
};

function buildMonthList(current: string, back: number, forward: number): string[] {
  const [cy, cm] = current.split("-").map((s) => parseInt(s, 10));
  const list: string[] = [];
  // Start from monthsForward ahead of current, going back monthsBack months.
  for (let i = forward; i >= -back; i--) {
    let year = cy;
    let month = cm + i;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    list.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return list;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export default function MonthPicker({
  current,
  monthsBack = 24,
  monthsForward = 3,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const months = buildMonthList(current, monthsBack, monthsForward);

  const value = months.includes(current) ? current : current;
  const options = months.includes(current) ? months : [current, ...months];

  return (
    <div className="inline-flex items-center gap-2">
      <Calendar className="w-4 h-4 text-slate-400" />
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          const params = new URLSearchParams(searchParams?.toString() ?? "");
          params.set("month", next);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="input w-auto text-sm"
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
