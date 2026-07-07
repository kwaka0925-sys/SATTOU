/**
 * SATTOU - 一括PDF出力スクリプト
 *
 * 指定した Google スプレッドシートの全タブを個別 PDF に変換し、
 * 指定した Google Drive フォルダに保存する GAS Web アプリ。
 *
 * sattou から呼び出される想定:
 *   POST <WEB_APP_URL>
 *   Body (JSON):
 *     {
 *       "token": "<SCRIPT_TOKEN と同じ文字列>",
 *       "sheetUrl": "<PDF化したいスプレッドシートのURL>",
 *       "folderUrl": "<PDF保存先のGoogle DriveフォルダURL>",
 *       "fileNamePrefix": "2026年7月請求書",     // 例。PDFのファイル名接頭辞
 *       "subfolderName": "2026年7月発送請求書", // 任意。指定するとその名前で
 *                                               // サブフォルダを作成し、
 *                                               // 全PDFをそこへ保存する
 *                                               // (同名フォルダがあれば再利用)
 *       "excludeHidden": true                    // 非表示タブを除外するか
 *     }
 *
 * セットアップ:
 *   1. https://script.google.com/ で新規プロジェクトを作成
 *   2. このファイルの内容を貼り付け
 *   3. プロジェクト設定 → スクリプトプロパティ で TOKEN を追加
 *      (ランダムな32文字以上の英数字を推奨)
 *   4. 「デプロイ」→ 「新しいデプロイ」→ ウェブアプリ
 *      - 実行するユーザー: 自分
 *      - アクセスできるユーザー: 全員
 *   5. 初回デプロイ時にスコープの承認を求められる:
 *      - Google Drive の表示・管理
 *      - Google スプレッドシートの表示・管理
 *      - 外部サービスへの接続
 *      すべて承認
 *   6. デプロイ URL を控えて sattou (Vercel) の環境変数に登録:
 *        SHEETS_GAS_URL_BULK_PDF   = デプロイ URL
 *        SHEETS_GAS_TOKEN_BULK_PDF = TOKEN
 */

const SLEEP_BETWEEN_TABS_MS = 1500; // レート制限回避のため（1.5秒間隔）
const MAX_RETRY = 5;                // 429 エラー時のリトライ回数
const RETRY_INITIAL_BACKOFF_MS = 2000; // 初回リトライまでの待機。以降指数バックオフ

function doPost(e) {
  try {
    const params = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!expected || params.token !== expected) {
      return jsonResponse_({ error: 'unauthorized' });
    }

    const sheetUrl = params.sheetUrl;
    const folderUrl = params.folderUrl;
    const fileNamePrefix = String(params.fileNamePrefix || 'PDF出力');
    const subfolderName = String(params.subfolderName || '');
    const excludeHidden = params.excludeHidden !== false;

    if (!sheetUrl || !folderUrl) {
      return jsonResponse_({
        error: 'sheetUrl and folderUrl are required',
      });
    }

    const spreadsheet = openSpreadsheet_(sheetUrl);
    if (!spreadsheet) {
      return jsonResponse_({
        error: 'スプレッドシートを開けませんでした。URL と共有設定を確認してください。',
      });
    }

    const parentFolder = openFolder_(folderUrl);
    if (!parentFolder) {
      return jsonResponse_({
        error: '保存先フォルダを開けませんでした。URL と共有設定を確認してください。',
      });
    }

    // サブフォルダ名が指定されていれば、その名前のフォルダを親の中に用意する。
    // 同名フォルダが既にあれば再利用 (今月分の追加出力にも対応)。
    const folder = subfolderName
      ? getOrCreateSubfolder_(parentFolder, subfolderName)
      : parentFolder;

    const spreadsheetId = spreadsheet.getId();
    const sheets = spreadsheet.getSheets().filter(function (s) {
      if (excludeHidden && s.isSheetHidden()) return false;
      return true;
    });

    const oauthToken = ScriptApp.getOAuthToken();
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (var i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const tabName = sheet.getName();
      const fileName = `${fileNamePrefix}_${tabName}.pdf`;
      try {
        const blob = exportSheetAsPdf_(spreadsheetId, sheet.getSheetId(), oauthToken);
        blob.setName(fileName);
        const file = folder.createFile(blob);
        results.push({
          tabName: tabName,
          fileName: fileName,
          fileId: file.getId(),
          fileUrl: file.getUrl(),
        });
        successCount++;
      } catch (err) {
        results.push({
          tabName: tabName,
          fileName: fileName,
          error: String(err && err.message ? err.message : err),
        });
        errorCount++;
      }
      // レート制限回避のための小休止
      if (i < sheets.length - 1) {
        Utilities.sleep(SLEEP_BETWEEN_TABS_MS);
      }
    }

    return jsonResponse_({
      folderUrl: folder.getUrl(),
      total: sheets.length,
      successCount: successCount,
      errorCount: errorCount,
      results: results,
    });
  } catch (err) {
    return jsonResponse_({ error: String(err && err.message ? err.message : err) });
  }
}

// URL からスプレッドシートを開く
function openSpreadsheet_(url) {
  try {
    return SpreadsheetApp.openByUrl(url);
  } catch (err) {
    return null;
  }
}

// URL または ID からフォルダを開く
function openFolder_(urlOrId) {
  try {
    // ID を URL から抽出
    var id = urlOrId;
    var match = urlOrId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) id = match[1];
    return DriveApp.getFolderById(id);
  } catch (err) {
    return null;
  }
}

// 親フォルダの中に指定名のサブフォルダを取得。存在しなければ作成する。
// 同名フォルダが複数ある場合は最初に見つかったものを返す。
function getOrCreateSubfolder_(parent, name) {
  var existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

// 特定タブを PDF ブロブとして取得。429 (Too Many Requests) は
// 指数バックオフで再試行し、Google のレート制限を吸収する。
function exportSheetAsPdf_(spreadsheetId, sheetId, oauthToken) {
  const exportUrl =
    'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export' +
    '?format=pdf' +
    '&gid=' + sheetId +
    '&portrait=true' +
    '&size=A4' +
    '&fitw=true' +
    '&sheetnames=false' +
    '&printtitle=false' +
    '&pagenumbers=false' +
    '&gridlines=false' +
    '&fzr=false';

  var lastCode = 0;
  var lastMessage = '';
  for (var attempt = 0; attempt <= MAX_RETRY; attempt++) {
    if (attempt > 0) {
      // 指数バックオフ: 2秒 → 4秒 → 8秒 → 16秒 → 32秒
      Utilities.sleep(RETRY_INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + oauthToken },
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    if (code === 200) {
      return response.getBlob();
    }

    lastCode = code;
    // 429 (rate limit) と 5xx (一時エラー) はリトライ対象
    if (code === 429 || (code >= 500 && code < 600)) {
      lastMessage = 'HTTP ' + code + ' (retryable)';
      continue;
    }
    // それ以外はリトライしても無駄なので即失敗
    throw new Error('PDF export HTTP ' + code);
  }
  throw new Error(
    'PDF export failed after ' + MAX_RETRY + ' retries. Last: ' + lastMessage,
  );
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// 動作確認用: 手動実行で自スプレッドシート全タブを Drive ルートに出力
function testExport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('Sheets: ' + ss.getSheets().length);
}
