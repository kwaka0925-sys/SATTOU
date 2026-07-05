/**
 * SATTOU - 請求書スプレッドシート連携用 Google Apps Script (GAS)
 *
 * 動作概要:
 *   - SATTOU の Next.js アプリ (/api/invoices/sync 経由 or Server Component) から
 *     ?token=...&month=YYYY-MM の GET リクエストを受け、
 *     対象月のシートを読み取って JSON で返す。
 *
 * 想定スプレッドシート列 (ヘッダ行 = 1行目、データは4行目以降):
 *   A: サロン名
 *   B: ブランド数         → brandCount (ダッシュボードの総ブランド数集計に利用)
 *   C: 店舗数             → storeCount (ダッシュボードの総店舗数集計に利用)
 *   D: 振替or請求書       → paymentMethod
 *   E: 加入者識別番号     → subscriberId
 *   F: 振込名             → payeeName
 *   G: 請求金額税込       → amount
 *   H: 進捗状況           → progress (請求書系の入金状況)
 *   L: 旧SATTOUユーザ     → legacyUser (チェック済みか否か)
 *   N: 口座振替進捗       → bankTransferProgress
 *   O: メモ               → note
 *   P: 継続ステータス     → subscriptionStatus
 *   Q: マーケティング担当 → marketer
 *   R: 別の広告費URL     → otherAdSpendUrl (広告費関連ドキュメントへのリンク)
 *   S: 広告費             → adSpend        (クライアントが実際に消化した広告費)
 *   T: 下限額             → minAmount      (最低運用代行費など任意の閾値)
 *   U: 運用代行(税抜)     → operationFeeExTax
 *   V: 運用代行(税込)     → operationFeeIncTax
 *
 * 各セルには数式を書いても getValues() が計算結果を返すため、そのまま
 * ダッシュボードに反映されます (例: U列に =S3*0.2 と書けば税抜運用代行費 = 広告費の20% を計算)。
 *
 * セットアップ:
 *   1. 対象スプレッドシートで「拡張機能 → Apps Script」を開く
 *   2. このファイル (Code.gs) の内容を貼り付け
 *   3. プロジェクト設定 → スクリプトプロパティ に TOKEN を追加
 *      (ランダム32文字以上の英数字を推奨)
 *   4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      - 実行: 自分
 *      - アクセス: 全員 (Anyone)
 *      - デプロイ後の URL を控える
 *   5. SATTOU リポジトリの .env.local に
 *        SHEETS_GAS_URL=...   (4. の URL)
 *        SHEETS_GAS_TOKEN=... (3. のトークン)
 *      を設定
 *
 * 月別タブ名:
 *   ?month=2026-04 を渡すと、以下の順でタブを探す:
 *     1. "2026-04"
 *     2. "2026年4月_請求管理"
 *     3. "2026年4月"
 *     4. "請求管理"
 *     5. アクティブシート
 *   実運用のタブ命名に合わせて MONTH_TAB_PATTERNS を編集してください。
 */

const HEADER_ROW = 1;
const DATA_START_ROW = 4;

const COLUMN_INDEX = {
  salonName: 1,            // A
  brandCount: 2,           // B
  storeCount: 3,           // C
  paymentMethod: 4,        // D
  subscriberId: 5,         // E
  payeeName: 6,            // F
  amount: 7,               // G
  progress: 8,             // H
  legacyUser: 12,          // L
  bankTransferProgress: 14, // N
  note: 15,                // O
  subscriptionStatus: 16,  // P
  marketer: 17,            // Q
  otherAdSpendUrl: 18,     // R
  adSpend: 19,             // S
  minAmount: 20,           // T
  operationFeeExTax: 21,   // U
  operationFeeIncTax: 22,  // V
};

function MONTH_TAB_PATTERNS(month) {
  const [y, m] = month.split('-');
  const mNum = parseInt(m, 10);
  return [
    month,
    `${y}年${mNum}月_請求管理`,
    `${y}年${mNum}月`,
    '請求管理',
  ];
}

function doGet(e) {
  const params = (e && e.parameter) || {};

  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected || params.token !== expected) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const month = params.month || currentMonth_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = resolveSheet_(ss, month);
  if (!sheet) {
    return jsonResponse({ error: `sheet not found for ${month}`, rows: [] });
  }

  const rows = readRows_(sheet);
  return jsonResponse({ month, sheet: sheet.getName(), rows });
}

function currentMonth_() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function resolveSheet_(ss, month) {
  const candidates = MONTH_TAB_PATTERNS(month);
  for (const name of candidates) {
    const s = ss.getSheetByName(name);
    if (s) return s;
  }
  return ss.getActiveSheet();
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const lastCol = Math.max(
    COLUMN_INDEX.marketer,
    sheet.getLastColumn(),
  );
  const range = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol);
  const values = range.getValues();

  const out = [];
  values.forEach((row, i) => {
    const salon = String(row[COLUMN_INDEX.salonName - 1] || '').trim();
    if (!salon) return;
    out.push({
      rowIndex: DATA_START_ROW + i,
      salonName: salon,
      brandCount: numberAt_(row, COLUMN_INDEX.brandCount),
      storeCount: numberAt_(row, COLUMN_INDEX.storeCount),
      paymentMethod: stringAt_(row, COLUMN_INDEX.paymentMethod),
      subscriberId: stringAt_(row, COLUMN_INDEX.subscriberId),
      payeeName: stringAt_(row, COLUMN_INDEX.payeeName),
      amount: rawAt_(row, COLUMN_INDEX.amount),
      progress: stringAt_(row, COLUMN_INDEX.progress),
      legacyUser: rawAt_(row, COLUMN_INDEX.legacyUser),
      bankTransferProgress: stringAt_(row, COLUMN_INDEX.bankTransferProgress),
      note: stringAt_(row, COLUMN_INDEX.note),
      subscriptionStatus: stringAt_(row, COLUMN_INDEX.subscriptionStatus),
      marketer: stringAt_(row, COLUMN_INDEX.marketer),
      otherAdSpendUrl: stringAt_(row, COLUMN_INDEX.otherAdSpendUrl),
      adSpend: numberAt_(row, COLUMN_INDEX.adSpend),
      minAmount: numberAt_(row, COLUMN_INDEX.minAmount),
      operationFeeExTax: numberAt_(row, COLUMN_INDEX.operationFeeExTax),
      operationFeeIncTax: numberAt_(row, COLUMN_INDEX.operationFeeIncTax),
    });
  });
  return out;
}

function stringAt_(row, col) {
  const v = row[col - 1];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Preserve checkbox booleans, dates (as ISO yyyy-MM-dd), and other raw values.
function rawAt_(row, col) {
  const v = row[col - 1];
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).trim();
}

function numberAt_(row, col) {
  const v = row[col - 1];
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const cleaned = String(v).replace(/[¥,\s円]/g, '');
  const n = parseInt(cleaned, 10);
  return isFinite(n) ? n : 0;
}

function jsonResponse(payload, _status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
