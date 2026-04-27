"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  FileText,
  Settings,
  CircleDot,
} from "lucide-react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/clients", label: "クライアント", icon: Users },
  { href: "/rankings", label: "ランキング・比較", icon: Trophy },
  { href: "/invoices", label: "請求書", icon: FileText },
  { href: "/settings", label: "設定", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">
            S
          </div>
          <div>
            <div className="font-semibold leading-tight">SATTOU Hub</div>
            <div className="text-xs text-slate-500">集客一元管理</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-slate-200 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CircleDot className="w-3 h-3 text-emerald-500" />
          Meta Ads API: 連携中
        </div>
        <div className="flex items-center gap-2 mt-1">
          <CircleDot className="w-3 h-3 text-emerald-500" />
          SATTOU API: 連携中
        </div>
      </div>
    </aside>
  );
}
