"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type Point = {
  name: string;
  spend: number;
  cpa: number;
  bookings: number;
};

export default function RankingScatter({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          dataKey="spend"
          name="広告費"
          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
        />
        <YAxis
          type="number"
          dataKey="cpa"
          name="CPA"
          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
        />
        <ZAxis type="number" dataKey="bookings" range={[60, 400]} name="予約数" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(value: number, name: string) => {
            if (name === "広告費" || name === "CPA") return [`¥${value.toLocaleString()}`, name];
            return [value.toLocaleString(), name];
          }}
          labelFormatter={() => ""}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const p = payload[0].payload as Point;
            return (
              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
                <div className="font-medium">{p.name}</div>
                <div className="text-slate-500">広告費: ¥{p.spend.toLocaleString()}</div>
                <div className="text-slate-500">CPA: ¥{p.cpa.toLocaleString()}</div>
                <div className="text-slate-500">予約: {p.bookings}件</div>
              </div>
            );
          }}
        />
        <Scatter data={data} fill="#347aff" fillOpacity={0.65} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
