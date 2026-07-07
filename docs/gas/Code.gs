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
  const opMonth = mNum === 1 ? 12 : mNum - 1;
  return [
    month,
    `${y}年${mNum}月_請求管理`,
    `${y}年${mNum}月`,
    `${y}年請求書${mNum}月`,
    `${y}年請求書${mNum}月（${opMonth}月稼働）`,
    `${y}年請求書${mNum}月(${opMonth}月稼働)`,
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
  const match = resolveSheet_(ss, month);
  if (!match) {
    // ★ アクティブシートへのフォールバックは行わない。
    //    見つからない事実を明示的に伝える方が誤動作より安全。
    return jsonResponse({
      error: `sheet not found for ${month}`,
      requested: month,
      tabs: ss.getSheets().map(function (s) { return s.getName(); }),
      rows: []
    });
  }

  const rows = readRows_(match);
  return jsonResponse({ month, sheet: match.getName(), rows });
}

function currentMonth_() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

// 全角括弧・全角数字・全角スペース等を吸収して比較しやすくする。
// 例: "2026年請求書8月（7月稼働）" と "2026年請求書8月(7月稼働)" を同一視。
function normalizeSheetName_(s) {
  if (!s) return '';
  return String(s)
    // 全角数字 → 半角数字
    .replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    // 全角英字 → 半角英字
    .replace(/[Ａ-Ｚａ-ｚ]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    })
    // 全角括弧 → 半角括弧
    .replace(/（/g, '(').replace(/）/g, ')')
    // 全角スペース → 半角スペース
    .replace(/　/g, ' ')
    // 全ての空白を除去
    .replace(/\s+/g, '')
    .toLowerCase();
}

// タブ解決を強化。以下の優先順で探し、それでも見つからなければ null を返す。
//   1. 厳密一致（既存パターン）
//   2. 正規化一致（半角/全角・空白の差異を吸収）
//   3. 部分一致（"YYYY年請求書M月" を含むタブを探す。「のコピー」等の付加も許容）
//   4. 部分一致（"YYYY-MM" を含むタブ）
function resolveSheet_(ss, month) {
  const [y, m] = month.split('-');
  const mNum = parseInt(m, 10);
  const candidates = MONTH_TAB_PATTERNS(month);
  const sheets = ss.getSheets();

  // 1. 厳密一致
  for (var i = 0; i < candidates.length; i++) {
    var s = ss.getSheetByName(candidates[i]);
    if (s) return s;
  }

  // 2. 正規化一致
  var normCandidates = candidates.map(normalizeSheetName_);
  for (var j = 0; j < sheets.length; j++) {
    var norm = normalizeSheetName_(sheets[j].getName());
    if (normCandidates.indexOf(norm) !== -1) return sheets[j];
  }

  // 3. 部分一致: "YYYY年請求書M月" を含む
  var partialA = normalizeSheetName_(`${y}年請求書${mNum}月`);
  for (var k = 0; k < sheets.length; k++) {
    var n = normalizeSheetName_(sheets[k].getName());
    if (n.indexOf(partialA) !== -1) return sheets[k];
  }

  // 4. 部分一致: "YYYY-MM"
  var partialB = normalizeSheetName_(month);
  for (var l = 0; l < sheets.length; l++) {
    var n2 = normalizeSheetName_(sheets[l].getName());
    if (n2.indexOf(partialB) !== -1) return sheets[l];
  }

  // 見つからなければ null。呼び出し側でエラーとして扱う。
  return null;
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
