import TopBar from "./TopBar";

// ページの初期ロード中 (Next.js の loading.tsx で使う) に表示するスケルトン UI。
// GAS への fetch が数秒かかっている間、真っ白な画面ではなく骨組みを見せることで
// 「フリーズした」と誤解されるのを防ぐ。
export default function PageSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="h-screen flex flex-col">
      <TopBar title={title} subtitle={subtitle ?? "読み込み中..."} />
      <div className="shrink-0 p-6 pb-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
              <div className="h-6 w-24 rounded bg-slate-200 animate-pulse mt-3" />
            </div>
          ))}
        </div>
        <div className="card p-4">
          <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
      <div className="flex-1 min-h-0 px-6 pb-6">
        <div className="card h-full flex flex-col overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-6 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 flex-1 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
