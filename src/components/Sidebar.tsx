"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Settings,
  CircleDot,
  BarChart3,
  Building2,
  ChevronDown,
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
  Users,
  MessageSquare,
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
  // collapsible=true にすると見出しをクリックで開閉できるアコーディオンになる。
  // defaultCollapsed=true で初回は閉じた状態で開始 (ユーザーの操作で開閉すると
  // その状態が localStorage に記録され次回以降も維持される)。
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

// アコーディオンの開閉状態を保存する localStorage キー。
// { [section.title]: boolean } の形。true = 閉じている / false = 開いている。
const SIDEBAR_COLLAPSED_KEY = "sattou-sidebar-collapsed";

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
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: "/clients", label: "請求書一覧", icon: FileText },
      {
        href: "/shareholder-invoices",
        label: "株主用請求書",
        icon: Users,
      },
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
    collapsible: true,
    defaultCollapsed: true,
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
    title: "問い合わせ",
    items: [
      { href: "/inquiries", label: "新規問い合わせ", icon: MessageSquare },
    ],
  },
  {
    title: "システム",
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: "/login-manager", label: "ログイン管理", icon: KeyRound },
      { href: "/admin-sheets", label: "管理系シート", icon: FileSpreadsheet },
      { href: "/settings", label: "設定", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  // 折りたたみ状態: true = 閉じている / undefined | false = 開いている。
  // 初期値は defaultCollapsed を採用、以後はユーザー操作が localStorage に上書き保存される。
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setCollapsed(parsed);
          return;
        }
      }
      // 初回訪問: defaultCollapsed=true のセクションだけ閉じておく。
      const initial: Record<string, boolean> = {};
      NAV_SECTIONS.forEach((s) => {
        if (s.collapsible && s.defaultCollapsed) initial[s.title] = true;
      });
      setCollapsed(initial);
    } catch {
      // ignore
    }
  }, []);

  const toggle = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_KEY,
          JSON.stringify(next),
        );
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  return (
    // SATTOU 本家の紺ベースに合わせつつ、少し明るめの青 (#3d5a80) で
    // 圧迫感を減らす配色。
    <aside className="w-60 shrink-0 border-r border-[#2b415f] bg-[#3d5a80] min-h-screen flex flex-col text-slate-100">
      {/* ロゴブロックだけ白背景 + 青文字。本家 SATTOU. の見え方に近づける。
          下のナビ部分 (紺背景) との境界がはっきり出るようにする。 */}
      <div className="px-5 py-5 border-b border-slate-200 bg-white">
        <Link href="/" className="flex flex-col gap-1.5">
          <div className="font-extrabold text-3xl tracking-tight text-brand-700 leading-none">
            SATTOU<span className="text-brand-500">.</span>
          </div>
          <div className="font-semibold text-sm text-brand-800 leading-tight">
            SATTOU管理表
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = section.collapsible && collapsed[section.title];
          return (
          <div key={section.title}>
            {section.collapsible ? (
              // 折りたたみ可能セクションの見出しはボタン化。クリックで開閉、
              // 開閉状態は右端のシェブロンで示す。
              <button
                type="button"
                onClick={() => toggle(section.title)}
                className="flex items-center justify-between w-full px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
              >
                <span>{section.title}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>
            ) : (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
            )}
            {!isCollapsed && (
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors group"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-slate-200 shrink-0" />
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
                        ? "bg-brand-500/20 text-white font-medium ring-1 ring-brand-400/30"
                        : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <CircleDot className="w-3 h-3 text-emerald-400" />
          Meta Ads API: 連携中
        </div>
        <div className="flex items-center gap-2 mt-1">
          <CircleDot className="w-3 h-3 text-emerald-400" />
          SATTOU API: 連携中
        </div>
      </div>
    </aside>
  );
}
