// Meta Marketing API 経由で広告アカウントごとの広告費を取得するモジュール。
// トークンは Vercel 環境変数 META_ADS_ACCESS_TOKEN 経由で読み込む。

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";

export type MetaSpendResult = {
  adAccountId: string;
  spend: number;
  currency?: string;
  error?: string;
};

// Meta 広告マネージャの URL から広告アカウントIDを抽出する。
// 例: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=960855844997758&...
//     → "act_960855844997758"
export function extractAdAccountIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/act=(\d+)/);
  return match ? `act_${match[1]}` : null;
}

// 1つの広告アカウントについて指定期間の spend を取得する。
export async function fetchAdAccountSpend(
  adAccountId: string,
  since: string,
  until: string,
  accessToken: string,
): Promise<MetaSpendResult> {
  try {
    const url = new URL(`${META_GRAPH_URL}/${adAccountId}/insights`);
    url.searchParams.set("fields", "spend,account_currency");
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since, until }),
    );
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), {
      // サーバー側で 5 分キャッシュ (同じ日付範囲での連続リクエストを吸収)
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        adAccountId,
        spend: 0,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      data?: Array<{ spend?: string; account_currency?: string }>;
      error?: { message?: string; code?: number };
    };

    if (data.error) {
      return {
        adAccountId,
        spend: 0,
        error: data.error.message ?? `Meta error code ${data.error.code}`,
      };
    }

    const insight = data.data?.[0];
    if (!insight) {
      // 指定期間に配信がない場合 data は空配列。エラーではなく 0 円扱い。
      return { adAccountId, spend: 0 };
    }

    return {
      adAccountId,
      spend: Math.round(parseFloat(insight.spend ?? "0")),
      currency: insight.account_currency,
    };
  } catch (err) {
    return {
      adAccountId,
      spend: 0,
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}

// 複数の広告アカウントを並列に取得。50社なら並列で ~1〜2秒。
// Meta の rate limit を考慮して同時実行数を軽く絞る。
export async function fetchSpendForAccounts(
  adAccounts: Array<{ adAccountId: string; clientKey: string }>,
  since: string,
  until: string,
  accessToken: string,
  concurrency = 10,
): Promise<Map<string, MetaSpendResult>> {
  const results = new Map<string, MetaSpendResult>();
  const queue = [...adAccounts];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      const result = await fetchAdAccountSpend(
        item.adAccountId,
        since,
        until,
        accessToken,
      );
      results.set(item.clientKey, result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, adAccounts.length) }, worker),
  );

  return results;
}
