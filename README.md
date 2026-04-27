# SATTOU Hub - 集客一元管理ダッシュボード（サンプル）

複数のクライアント（整体院・美容院・エステ等 50〜100社）の集客状況を、
Meta広告APIとSATTOU予約APIのデータを紐付けて一元管理するためのサンプルツールです。

## 主な機能

- **ダッシュボード**: グループ全体のCPA・予約数・ROAS・広告費の推移と、優秀／要改善クライアントのハイライト
- **クライアント一覧**: 業種・地域・ステータスでの絞り込み、各種指標でのソート（64社のサンプルデータ収録）
- **クライアント詳細**: 広告×予約の30日推移、CPA推移、日別ログ、関連請求書
- **ランキング・比較**: 指標別ランキング、広告費 vs CPAの散布図、最大4社の横並び比較
- **請求書管理**: 一覧、検索、ステータス管理、印刷・PDF・送信ボタン付きのA4テンプレート

## 技術スタック

- Next.js 15 (App Router) + React 19
- TypeScript / Tailwind CSS
- Recharts（グラフ）/ lucide-react（アイコン）
- データはすべてモック（`src/lib/mock.ts`）。実APIに差し替えれば本番運用が可能です。

## セットアップ

```bash
npm install
npm run dev
```

http://localhost:3000 にアクセス。

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                # ダッシュボード
│   ├── clients/                # クライアント一覧 / 詳細
│   ├── rankings/               # ランキング・比較
│   ├── invoices/               # 請求書一覧 / 詳細
│   └── settings/               # 設定
├── components/                 # UI コンポーネント
└── lib/
    ├── mock.ts                 # サンプルデータ生成（64社）
    ├── format.ts               # 通貨・数値フォーマット
    └── types.ts                # 型定義
```

## 実APIへの差し替えポイント

`src/lib/mock.ts` の `CLIENTS` 配列を置き換えるだけで、各画面が実データで動作します。
たとえば次のようなサーバーサイド処理に置き換えてください：

- Meta Marketing API: `act_xxx` の `insights` を日別取得 → `daily.spend / impressions / clicks` に充当
- SATTOU API: 各店舗の予約・来店・売上を取得 → `daily.bookings`, `metrics30d.completedVisits / revenue` に充当
- 請求書: 自社の請求管理DBから `invoices` を取得
