"use client";

import { Bell, Search } from "lucide-react";

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="クライアントを検索..."
              className="input pl-9 w-72"
            />
          </div>
          <button className="btn-ghost relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-sm font-medium">
              KW
            </div>
            <div className="text-sm">
              <div className="font-medium leading-tight">運用担当者</div>
              <div className="text-xs text-slate-500">admin@sattou.app</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
