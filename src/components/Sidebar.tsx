"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  CircleDot,
  BarChart3,
  Upload,
  Building2,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "経営",
    items: [
      { href: "/", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "クライアント",
    items: [
      { href: "/clients", label: "請求書一覧", icon: Users },
      { href: "/stores", label: "sattou導入店舗", icon: Building2 },
    ],
  },
  {
    title: "広告売上費",
    items: [
      { href: "/ads", label: "広告売上費", icon: BarChart3 },
    ],
  },
  {
    title: "請求",
    items: [
      { href: "/invoices", label: "請求書", icon: FileText, exact: true },
      { href: "/invoices/import", label: "取り込み", icon: Upload },
    ],
  },
  {
    title: "システム",
    items: [
      { href: "/settings", label: "設定", icon: Settings },
    ],
  },
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
      <nav className="flex-1 p-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
