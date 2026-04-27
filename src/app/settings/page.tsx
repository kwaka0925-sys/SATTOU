import TopBar from "@/components/TopBar";
import { CheckCircle2, KeyRound, Webhook } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <TopBar title="設定" subtitle="API連携・チーム・通知などの基本設定" />
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4" /> API連携
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">Meta Marketing API</div>
                <div className="text-xs text-slate-500">広告費・インプレッション・クリック・CV を取得</div>
              </div>
              <span className="pill bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> 接続済み
              </span>
            </li>
            <li className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">SATTOU 予約API</div>
                <div className="text-xs text-slate-500">予約数・来店数・売上 を取得</div>
              </div>
              <span className="pill bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> 接続済み
              </span>
            </li>
            <li className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">Google広告 API</div>
                <div className="text-xs text-slate-500">将来対応予定</div>
              </div>
              <span className="pill bg-slate-100 text-slate-600">未接続</span>
            </li>
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Webhook className="w-4 h-4" /> 通知
          </h2>
          <div className="text-sm text-slate-500">
            CPAが閾値を超えた場合や、予約が急増・急減した場合の Slack / メール通知をここで設定します。（サンプルのため未実装）
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-2">データの更新タイミング</h2>
          <p className="text-sm text-slate-500">
            Meta Ads APIとSATTOU APIから日次でデータを取得します。手動更新も可能です。
          </p>
          <button className="btn-ghost mt-4">今すぐ更新</button>
        </div>
      </div>
    </div>
  );
}
