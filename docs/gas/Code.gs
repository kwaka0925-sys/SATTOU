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

  // action=migrations: 「新システム移行」タブ全件を返す。
  // これは月に依存しないので month パラメータは無視する。
  if (params.action === 'migrations') {
    return handleGetMigrations_();
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

// -------------------------------------------------------------------
// 新システム移行タブ (共有データ)
//
// このタブは請求書の月別タブとは独立で、識別番号を主キーに 1 行 = 1 クライアント。
// 列 (1 行目にヘッダ、2 行目以降にデータ):
//   A: 加入者識別番号 (主キー)
//   B: サロン名        (人間が見るためのラベル。上書き参照)
//   C: 移行完了         (TRUE / FALSE)
//   D: システム移行日   (yyyy-MM-dd 文字列)
//   E: システム移行予定日 (yyyy-MM-dd 文字列)
//   F: メモ             (自由テキスト)
//
// タブが無ければ 1 度だけ自動作成する。sattou 側からの初回アクセス時に、
// 手作業でタブを作らなくてもすぐ使えるようにする。
// -------------------------------------------------------------------

const MIGRATION_SHEET_NAME = '新システム移行';
const MIGRATION_HEADER = [
  '加入者識別番号',
  'サロン名',
  '移行完了',
  'システム移行日',
  'システム移行予定日',
  'メモ',
];
const MIGRATION_COL = {
  subscriberId: 1,
  clientName: 2,
  completed: 3,
  migrationDate: 4,
  plannedDate: 5,
  note: 6,
};

function getOrCreateMigrationSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MIGRATION_SHEET_NAME);
  if (sheet) return sheet;
  sheet = ss.insertSheet(MIGRATION_SHEET_NAME);
  sheet
    .getRange(1, 1, 1, MIGRATION_HEADER.length)
    .setValues([MIGRATION_HEADER])
    .setFontWeight('bold')
    .setBackground('#f1f5f9');
  sheet.setFrozenRows(1);
  // チェックボックスは行追加時に個別に敷く。
  // 事前一括挿入は getLastRow() を膨らませて挿入位置がずれる原因になる。
  return sheet;
}

// migrations タブ全件を { subscriberId → { completed, migrationDate, plannedDate, note, clientName } } の形で返す。
function handleGetMigrations_() {
  const sheet = getOrCreateMigrationSheet_();
  const lastRow = sheet.getLastRow();
  const out = {};
  if (lastRow < 2) {
    return jsonResponse({ ok: true, sheet: sheet.getName(), migrations: out });
  }
  const range = sheet.getRange(2, 1, lastRow - 1, MIGRATION_HEADER.length);
  const values = range.getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var sid = String(row[MIGRATION_COL.subscriberId - 1] || '').trim();
    if (!sid) continue;
    out[sid] = {
      clientName: String(row[MIGRATION_COL.clientName - 1] || '').trim(),
      completed: row[MIGRATION_COL.completed - 1] === true,
      migrationDate: formatDateCell_(row[MIGRATION_COL.migrationDate - 1]),
      plannedDate: formatDateCell_(row[MIGRATION_COL.plannedDate - 1]),
      note: String(row[MIGRATION_COL.note - 1] || ''),
    };
  }
  return jsonResponse({ ok: true, sheet: sheet.getName(), migrations: out });
}

// 単一行の upsert。既存の subscriberId があれば patch を当てる、無ければ末尾に追加。
// リクエスト: { token, action: "upsertMigration", subscriberId, clientName, patch: { completed?, migrationDate?, plannedDate?, note? } }
//
// 実装ノート:
//   - 挿入位置は A 列 (subscriberId) の実データだけを走査して決める。
//     getLastRow() は空セルでもチェックボックスなどが挿入されていると値を返すので、
//     それに頼ると挿入位置が狂ってサロン名などの上書きに失敗する。
//   - 2 ユーザー同時編集での競合を防ぐため LockService で 15 秒待機する。
function handleUpsertMigration_(params) {
  const subscriberId = String(params.subscriberId || '').trim();
  if (!subscriberId) {
    return jsonResponse({ error: 'subscriberId is required' });
  }
  const patch = params.patch || {};
  const clientName = String(params.clientName || '').trim();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({ error: 'sheet is busy, retry shortly' });
  }
  try {
    const sheet = getOrCreateMigrationSheet_();
    const maxRows = sheet.getMaxRows();

    // A 列 (subscriberId) を 1 度読み込み、
    //   1) 同じ subscriberId の既存行 (matchRow)
    //   2) A 列に何か入っている最後の行 (lastDataRow)
    // を同時に確定する。
    var matchRow = -1;
    var lastDataRow = 1; // ヘッダのみ
    if (maxRows >= 2) {
      const colA = sheet.getRange(2, 1, maxRows - 1, 1).getValues();
      for (var i = 0; i < colA.length; i++) {
        var v = String(colA[i][0] || '').trim();
        if (!v) continue;
        if (i + 2 > lastDataRow) lastDataRow = i + 2;
        if (matchRow < 0 && v === subscriberId) {
          matchRow = i + 2;
        }
      }
    }

    var rowIndex;
    if (matchRow < 0) {
      rowIndex = lastDataRow + 1;
      sheet
        .getRange(rowIndex, 1, 1, MIGRATION_HEADER.length)
        .setValues([[subscriberId, clientName, false, '', '', '']]);
      // 追加行の C 列にチェックボックスを敷く (行ごと個別)。
      sheet
        .getRange(rowIndex, MIGRATION_COL.completed)
        .insertCheckboxes();
    } else {
      rowIndex = matchRow;
      // clientName が変わった時のために B 列だけ最新化する。
      if (clientName) {
        sheet.getRange(rowIndex, MIGRATION_COL.clientName).setValue(clientName);
      }
    }

    if (patch.hasOwnProperty('completed')) {
      sheet
        .getRange(rowIndex, MIGRATION_COL.completed)
        .setValue(!!patch.completed);
    }
    if (patch.hasOwnProperty('migrationDate')) {
      sheet
        .getRange(rowIndex, MIGRATION_COL.migrationDate)
        .setValue(patch.migrationDate == null ? '' : String(patch.migrationDate));
    }
    if (patch.hasOwnProperty('plannedDate')) {
      sheet
        .getRange(rowIndex, MIGRATION_COL.plannedDate)
        .setValue(patch.plannedDate == null ? '' : String(patch.plannedDate));
    }
    if (patch.hasOwnProperty('note')) {
      sheet
        .getRange(rowIndex, MIGRATION_COL.note)
        .setValue(patch.note == null ? '' : String(patch.note));
    }
    return jsonResponse({
      ok: true,
      sheet: sheet.getName(),
      rowIndex: rowIndex,
    });
  } finally {
    lock.releaseLock();
  }
}

// 日付セルは Date 型で入っている場合と文字列の場合があるので、
// yyyy-MM-dd の文字列に正規化する。空欄は空文字。
function formatDateCell_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).trim();
}

// 書き込み許可する列。UI が触るドロップダウン/テキスト入力および Meta 同期で
// 上書きする広告費列を対象にする。金額 (G) や運用代行費 (U/V) など集計計算式が
// 入っている可能性のある列は誤書き込み防止のため除外。
const WRITEABLE_FIELDS = {
  paymentMethod: COLUMN_INDEX.paymentMethod,        // D: 振替 / 請求書
  progress: COLUMN_INDEX.progress,                  // H: 進捗確認
  bankTransferProgress: COLUMN_INDEX.bankTransferProgress, // N: 口座振替進捗
  note: COLUMN_INDEX.note,                          // O: メモ
  subscriptionStatus: COLUMN_INDEX.subscriptionStatus, // P: 継続
  marketer: COLUMN_INDEX.marketer,                  // Q: 担当
  adSpend: COLUMN_INDEX.adSpend,                    // S: 広告費 (Meta 同期の書き戻し先)
};

// UI から呼ばれるセル更新 API。
// リクエスト: { token, action: "updateCell", month, subscriberId, field, value }
// レスポンス: { ok: true, sheet, rowIndex, column } / { error: "..." }
function doPost(e) {
  var params;
  try {
    params = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonResponse({ error: 'invalid JSON body' });
  }

  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected || params.token !== expected) {
    return jsonResponse({ error: 'unauthorized' });
  }

  if (params.action === 'updateCell') {
    return handleUpdateCell_(params);
  }
  if (params.action === 'updateCells') {
    return handleUpdateCells_(params);
  }
  if (params.action === 'upsertMigration') {
    return handleUpsertMigration_(params);
  }
  return jsonResponse({ error: 'unknown action: ' + params.action });
}

// 単セル更新。旧 UI (ClientsView の SyncDot) が使う既存 API。
function handleUpdateCell_(params) {
  const month = String(params.month || '').trim();
  const subscriberId = String(params.subscriberId || '').trim();
  const field = String(params.field || '').trim();
  const value = params.value == null ? '' : String(params.value);

  if (!month || !subscriberId || !field) {
    return jsonResponse({
      error: 'month, subscriberId, field are required',
    });
  }
  if (!WRITEABLE_FIELDS.hasOwnProperty(field)) {
    return jsonResponse({ error: 'field not writeable: ' + field });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = resolveSheet_(ss, month);
  if (!sheet) {
    return jsonResponse({ error: 'sheet not found for ' + month });
  }

  const rowIndex = findRowBySubscriberId_(sheet, subscriberId);
  if (rowIndex < 0) {
    return jsonResponse({
      error: 'subscriberId not found in sheet: ' + subscriberId,
    });
  }

  const col = WRITEABLE_FIELDS[field];
  sheet.getRange(rowIndex, col).setValue(value);
  return jsonResponse({
    ok: true,
    sheet: sheet.getName(),
    rowIndex: rowIndex,
    column: col,
  });
}

// バッチ更新。Meta 同期が 68 社分の広告費をまとめて書き戻すのに使う。
// リクエスト: { token, action: "updateCells", month, items: [{subscriberId, field, value}, ...] }
// レスポンス: { ok: true, sheet, updated: N, missing: [...] }
// 呼び出し 1 回で全件を処理するので、GAS のレート制限に引っかかりにくい。
function handleUpdateCells_(params) {
  const month = String(params.month || '').trim();
  const items = Array.isArray(params.items) ? params.items : null;
  if (!month || !items) {
    return jsonResponse({ error: 'month and items[] are required' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = resolveSheet_(ss, month);
  if (!sheet) {
    return jsonResponse({ error: 'sheet not found for ' + month });
  }

  // subscriberId → row index の逆引きマップを 1 度だけ構築。
  const lastRow = sheet.getLastRow();
  const idMap = {};
  if (lastRow >= DATA_START_ROW) {
    const range = sheet.getRange(
      DATA_START_ROW,
      COLUMN_INDEX.subscriberId,
      lastRow - DATA_START_ROW + 1,
      1,
    );
    const values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var v = values[i][0];
      if (v == null || v === '') continue;
      var key = String(v).trim();
      if (!idMap.hasOwnProperty(key)) {
        idMap[key] = DATA_START_ROW + i;
      }
    }
  }

  var updated = 0;
  var missing = [];
  var invalid = [];
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var sid = String((item && item.subscriberId) || '').trim();
    var field = String((item && item.field) || '').trim();
    var value = item && item.value == null ? '' : String(item.value);
    if (!sid || !field) continue;
    if (!WRITEABLE_FIELDS.hasOwnProperty(field)) {
      invalid.push({ subscriberId: sid, field: field });
      continue;
    }
    var rowIndex = idMap[sid];
    if (!rowIndex) {
      missing.push(sid);
      continue;
    }
    var col = WRITEABLE_FIELDS[field];
    sheet.getRange(rowIndex, col).setValue(value);
    updated++;
  }
  return jsonResponse({
    ok: true,
    sheet: sheet.getName(),
    updated: updated,
    missing: missing,
    invalid: invalid,
  });
}

// 加入者識別番号 (E列) からデータ行を探す。見つからなければ -1。
// 数値 ID / 文字列 ID どちらでも一致するように文字列比較 + 前後空白除去。
function findRowBySubscriberId_(sheet, subscriberId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return -1;
  const range = sheet.getRange(
    DATA_START_ROW,
    COLUMN_INDEX.subscriberId,
    lastRow - DATA_START_ROW + 1,
    1,
  );
  const values = range.getValues();
  const target = String(subscriberId).trim();
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    if (v == null || v === '') continue;
    if (String(v).trim() === target) {
      return DATA_START_ROW + i;
    }
  }
  return -1;
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
