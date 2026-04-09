import { getRpcBaseUrl } from '@/services/rpc-client';
import { NewsServiceClient } from '@/generated/client/worldmonitor/news/v1/service_client';
import { SITE_VARIANT } from '@/config';
import { getCurrentLanguage } from '@/services/i18n';
import { toApiUrl } from '@/services/runtime';
import { isFeatureAvailable } from './runtime-config';

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

const newsClient = new NewsServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });

const API_PROVIDERS: Array<'ollama' | 'groq' | 'openrouter'> = ['ollama', 'groq', 'openrouter'];

function compactItemSummary(item: MediaTavilyNewsItem): string {
  return (item.summary || item.title).replace(/\s+/g, ' ').trim().slice(0, 160);
}

function rankForecastItems(items: MediaTavilyNewsItem[]): MediaTavilyNewsItem[] {
  return [...items]
    .sort((a, b) => (b.publishedAt - a.publishedAt) || (b.summary.length - a.summary.length))
    .slice(0, 3);
}

function buildFallbackForecast(items: MediaTavilyNewsItem[]): string {
  const sources = [...new Set(items.map((item) => item.source))].slice(0, 3);
  if (items.length === 0) return '当前未获取到足够的媒体新闻样本，暂时无法形成稳定预测。';
  return `未来24-72小时内，媒体行业大概率继续围绕平台分发、内容投入与创作者变现展开博弈，编辑部应优先跟踪 ${sources.join('、')} 等来源的后续进展，并留意广告预算与平台策略是否同步变化。`;
}

export async function fetchMediaTavilyNews(limit = 12, days = 7): Promise<MediaTavilyNewsResponse> {
  const url = new URL(toApiUrl('/api/news/v1/list-media-tavily-news'), window.location.origin);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('days', String(days));

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`Media Tavily news HTTP ${response.status}`);
  }

  return response.json() as Promise<MediaTavilyNewsResponse>;
}

export async function summarizeMediaNewsItem(item: MediaTavilyNewsItem): Promise<string | null> {
  const headlines = [
    item.title,
    item.summary ? `Context: ${compactItemSummary(item)}` : '',
    `Source: ${item.source}`,
  ].filter(Boolean);

  for (const provider of API_PROVIDERS) {
    const featureId = provider === 'ollama' ? 'aiOllama' : provider === 'groq' ? 'aiGroq' : 'aiOpenRouter';
    if (!isFeatureAvailable(featureId)) continue;
    const resp = await newsClient.summarizeArticle({
      provider,
      headlines,
      mode: 'event-brief',
      geoContext: `Media industry news. Article source: ${item.source}. Link: ${item.url}`,
      variant: SITE_VARIANT,
      lang: getCurrentLanguage(),
      systemAppend: '',
    });
    if (!resp.fallback && resp.summary.trim()) return resp.summary.trim();
  }

  return null;
}

export async function generateMediaNewsForecast(items: MediaTavilyNewsItem[]): Promise<{ summary: string; model: string } | null> {
  const ranked = rankForecastItems(items);
  const headlines = ranked.map((item) => item.title.slice(0, 120));
  if (headlines.length === 0) return null;

  const geoContext = [
    'Media industry forecast.',
    'Focus on next 24-72 hours.',
    'Cover newsroom priorities, distribution, advertiser sentiment, and audience attention.',
    ...ranked.map((item) => `Source ${item.source}: ${compactItemSummary(item)}`),
  ].join(' ');

  for (const provider of API_PROVIDERS) {
    const featureId = provider === 'ollama' ? 'aiOllama' : provider === 'groq' ? 'aiGroq' : 'aiOpenRouter';
    if (!isFeatureAvailable(featureId)) continue;
    const resp = await newsClient.summarizeArticle({
      provider,
      headlines,
      mode: 'media-forecast',
      geoContext,
      variant: 'media',
      lang: getCurrentLanguage(),
      systemAppend: '',
    });
    if (!resp.fallback && resp.summary.trim()) {
      return { summary: resp.summary.trim(), model: resp.model || provider };
    }
  }

  return { summary: buildFallbackForecast(ranked), model: 'fallback' };
}
