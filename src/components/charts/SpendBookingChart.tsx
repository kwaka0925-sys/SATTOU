"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Bar,
} from "recharts";
import { shortDate } from "@/lib/format";

type Datum = {
  date: string;
  spend: number;
  bookings: number;
};

export function SpendBookingChart({ data }: { data: Datum[] }) {
  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={formatted} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#347aff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#347aff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(value: number, name: string) => {
            if (name === "広告費") return [`¥${value.toLocaleString()}`, name];
            return [value.toLocaleString(), name];
          }}
        />
        <Area yAxisId="left" type="monotone" dataKey="spend" name="広告費" stroke="#347aff" strokeWidth={2} fill="url(#spendGrad)" />
        <Bar yAxisId="right" dataKey="bookings" name="予約数" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CpaTrendChart({ data }: { data: { date: string; cpa: number }[] }) {
  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cpaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(value: number) => [`¥${value.toLocaleString()}`, "CPA"]}
        />
        <Area type="monotone" dataKey="cpa" stroke="#f59e0b" strokeWidth={2} fill="url(#cpaGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({
  data,
  dataKey,
  color = "#347aff",
}: {
  data: { date: string; [k: string]: string | number }[];
  dataKey: string;
  color?: string;
}) {
  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <ComposedChart data={formatted}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
