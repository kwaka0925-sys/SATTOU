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
cp .env.example .env.local   # GAS連携を使う場合（後述）
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
- 請求書: GAS 連携でスプレッドシートから直接取得（次節）

## GAS連携（請求書スプレッドシート）

`/invoices` ページは、Google スプレッドシートで管理している月別の請求情報を
GAS Web App 経由で読み取り表示します。

### 1. Apps Script のデプロイ

1. 対象スプレッドシートで「拡張機能 → Apps Script」を開く
2. `docs/gas/Code.gs` の内容を `Code.gs` に貼り付けて保存
3. プロジェクト設定 → スクリプトプロパティ で `TOKEN` を追加（ランダム32文字以上推奨）
4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
   - 実行: 自分
   - アクセス: 全員
   - 発行された URL を控える

### 2. 環境変数

`.env.local` を作成し以下を設定:

```
SHEETS_GAS_URL=https://script.google.com/macros/s/.../exec
SHEETS_GAS_TOKEN=（Apps Script に登録した TOKEN と同じ値）
```

### 3. シート列マッピング

`docs/gas/Code.gs` の `COLUMN_INDEX` で列を定義しています。実シートの列構成に合わせて
編集してください。デフォルトは下記:

| 列 | 内容 | アプリ側 |
|---|---|---|
| A | サロン名 | クライアント名 |
| D | 振替or請求書 | 支払方法 |
| E | 加入者識別番号 | subscriberId |
| F | 振込名 | payeeName |
| G | 請求金額税込 | amount |
| H | 進捗状況 | status 算出 |
| N | 口座振替進捗 | status 算出 |
| O | メモ | note |
| P | 継続ステータス | "解約" は draft |
| Q | マーケティング担当 | marketer |

### 4. 月別タブの解決

`?month=YYYY-MM` で対象タブを切り替え可能。タブ名は

1. `2026-04`
2. `2026年4月_請求管理`
3. `2026年4月`
4. `請求管理`
5. アクティブシート

の順に検索します。

### 5. 動作確認

ブラウザで以下を直接開き、JSON が返ることを確認:

```
https://script.google.com/macros/s/.../exec?token=YOUR_TOKEN&month=2026-04
```

`npm run dev` 後、`http://localhost:3000/invoices` でシート内容が表示されます。
GAS 側で行を編集した場合、最大 60 秒のキャッシュ経由で反映されます（即時反映したい場合は
`http://localhost:3000/api/invoices/sync?month=2026-04` を叩くか、サーバ再起動）。
