import { cachedFetchJson } from '../../../_shared/redis';
import { CHROME_UA } from '../../../_shared/constants';

export interface MediaTavilyNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  summary: string;
}

export interface MediaTavilyNewsResponse {
  items: MediaTavilyNewsItem[];
  provider: 'tavily' | 'none';
  query: string;
}

const CACHE_TTL_SECONDS = 900;
const DEFAULT_LIMIT = 12;
const DEFAULT_DAYS = 7;
const DEFAULT_QUERY = 'media industry OR streaming OR publishers OR advertising OR newsroom OR creator economy latest news';
const NOISE_PATTERNS = [
  /sponsored by/ig,
  /search jobs/ig,
  /post a job/ig,
  /event calendar/ig,
  /become a member/ig,
  /join tvn plus/ig,
  /newsletter/ig,
];

function splitApiKeys(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\n,]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

function parsePublishedAt(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) return 0;
  const parsed = Date.parse(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Unknown source';
  } catch {
    return 'Unknown source';
  }
}

function tavilyTimeRange(days: number): 'day' | 'week' | 'month' {
  if (days <= 1) return 'day';
  if (days <= 7) return 'week';
  return 'month';
}

function sanitizeLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(3, Math.min(20, Math.floor(value)));
}

function sanitizeDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.max(1, Math.min(30, Math.floor(value)));
}

function dedupeItems(items: MediaTavilyNewsItem[], limit: number): MediaTavilyNewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => item.title && item.url)
    .filter((item) => {
      const key = `${item.url.toLowerCase()}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit);
}

function compactSummary(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, '');
  }
  text = text.replace(/\[\.\.\.\].*/g, '').trim();
  return text.slice(0, 240).trim();
}

async function searchWithTavily(query: string, limit: number, days: number, apiKey: string): Promise<MediaTavilyNewsItem[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': CHROME_UA,
    },
    body: JSON.stringify({
      query,
      topic: 'news',
      search_depth: 'advanced',
      time_range: tavilyTimeRange(days),
      max_results: Math.min(limit, 20),
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_favicon: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Tavily HTTP ${response.status}`);
  }

  const payload = await response.json() as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };

  return dedupeItems(
    (payload.results || []).map((item) => ({
      title: String(item.title || '').trim(),
      url: String(item.url || '').trim(),
      source: extractDomain(String(item.url || '')),
      publishedAt: parsePublishedAt(item.published_date),
      summary: compactSummary(String(item.content || '').trim()),
    })),
    limit,
  );
}

export async function listMediaTavilyNews(url: URL): Promise<MediaTavilyNewsResponse> {
  const query = (url.searchParams.get('query') || DEFAULT_QUERY).trim().slice(0, 240);
  const limit = sanitizeLimit(Number(url.searchParams.get('limit') || DEFAULT_LIMIT));
  const days = sanitizeDays(Number(url.searchParams.get('days') || DEFAULT_DAYS));
  const apiKeys = splitApiKeys(process.env.TAVILY_API_KEYS);

  if (apiKeys.length === 0) {
    return { items: [], provider: 'none', query };
  }

  const cacheKey = `news:media-tavily:v1:${query}:${limit}:${days}`;
  const cached = await cachedFetchJson<MediaTavilyNewsResponse>(cacheKey, CACHE_TTL_SECONDS, async () => {
    for (const apiKey of apiKeys) {
      try {
        const items = await searchWithTavily(query, limit, days, apiKey);
        if (items.length > 0) {
          return { items, provider: 'tavily', query };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[media-tavily-news] Tavily failed: ${message}`);
      }
    }

    return { items: [], provider: 'none', query };
  }, 120);

  return cached || { items: [], provider: 'none', query };
}
