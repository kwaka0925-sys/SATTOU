"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Settings,
  CircleDot,
  BarChart3,
  Building2,
  UserX,
  UserPlus,
  FileSignature,
  Store,
  Sparkles,
  KeyRound,
  FileSpreadsheet,
  Landmark,
  ExternalLink,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  external?: boolean;
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
    title: "導入店舗",
    items: [
      { href: "/stores", label: "sattou導入店舗", icon: Building2 },
    ],
  },
  {
    title: "新システム移行",
    items: [
      {
        href: "/system-migration",
        label: "新システム移行",
        icon: ArrowRightLeft,
      },
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
      { href: "/clients", label: "請求書一覧", icon: FileText },
      {
        href: "/invoicing-sheet",
        label: "請求書作成用スプシ",
        icon: FileSpreadsheet,
      },
      {
        href: "/bank-transfer-sheet",
        label: "口座振替用スプシ",
        icon: Landmark,
      },
    ],
  },
  {
    title: "契約",
    items: [
      { href: "/contracts", label: "契約書関連", icon: FileSignature },
    ],
  },
  {
    title: "新規",
    items: [
      { href: "/new-registrations", label: "新規登録", icon: UserPlus },
      { href: "/store-additions", label: "店舗追加", icon: Store },
      { href: "/hpb-additions", label: "ホットペッパー連携追加", icon: Sparkles },
    ],
  },
  {
    title: "解約",
    items: [
      { href: "/cancellations", label: "解約一覧", icon: UserX },
    ],
  },
  {
    title: "システム",
    items: [
      { href: "/login-manager", label: "ログイン管理", icon: KeyRound },
      { href: "/admin-sheets", label: "管理系シート", icon: FileSpreadsheet },
      { href: "/settings", label: "設定", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200">
        <Link href="/" className="flex flex-col gap-1.5">
          {/* ロゴ: サイドバーの横幅 (w-60 = 240px) いっぱいに広げた SATTOU. */}
          <div className="font-extrabold text-3xl tracking-tight text-slate-900 leading-none">
            SATTOU<span className="text-brand-600">.</span>
          </div>
          <div className="font-semibold text-sm text-slate-700 leading-tight">
            SATTOU管理表
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
                const Icon = item.icon;
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors group"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-slate-500 shrink-0" />
                    </a>
                  );
                }
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
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
