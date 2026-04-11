import { SITE_VARIANT } from '@/config';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { NewsServiceClient } from '@/generated/client/worldmonitor/news/v1/service_client';
import { buildSummaryCacheKey } from '@/utils/summary-cache-key';
import { isFeatureAvailable } from './runtime-config';
import type { SummarizationProvider, SummarizationResult } from './summarization';
import { generateSummary } from './summarization';

interface ApiProviderDef {
  featureId: 'aiOllama' | 'aiGroq' | 'aiOpenRouter';
  provider: Exclude<SummarizationProvider, 'browser' | 'cache'>;
}

const newsClient = new NewsServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });

const API_PROVIDERS: ApiProviderDef[] = [
  { featureId: 'aiOllama', provider: 'ollama' },
  { featureId: 'aiGroq', provider: 'groq' },
  { featureId: 'aiOpenRouter', provider: 'openrouter' },
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function generateEventBrief(
  headlines: string[],
  geoContext = '',
  lang = 'en',
  signal?: AbortSignal,
): Promise<SummarizationResult | null> {
  const cleaned = headlines.map(item => item.trim()).filter(Boolean).slice(0, 8);
  if (cleaned.length === 0) return null;

  const cacheKey = buildSummaryCacheKey(cleaned, 'event-brief', geoContext, SITE_VARIANT, lang);
  try {
    const cached = await newsClient.getSummarizeArticleCache({ cacheKey }, { signal });
    if (cached.summary) {
      return {
        summary: cached.summary,
        provider: 'cache',
        model: cached.model || '',
        cached: true,
      };
    }
  } catch {
    // Ignore cache miss or transient request failures and continue to providers.
  }

  for (const providerDef of API_PROVIDERS) {
    if (!isFeatureAvailable(providerDef.featureId)) continue;
    try {
      const resp = await withTimeout(newsClient.summarizeArticle({
        provider: providerDef.provider,
        headlines: cleaned,
        mode: 'event-brief',
        geoContext,
        variant: SITE_VARIANT,
        lang,
        systemAppend: '',
      }, { signal }), 14_000);

      if (resp.status === 'SUMMARIZE_STATUS_SKIPPED' || resp.fallback) continue;
      const summary = typeof resp.summary === 'string' ? resp.summary.trim() : '';
      if (!summary) continue;

      return {
        summary,
        provider: resp.status === 'SUMMARIZE_STATUS_CACHED' ? 'cache' : providerDef.provider,
        model: resp.model || providerDef.provider,
        cached: resp.status === 'SUMMARIZE_STATUS_CACHED',
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
    }
  }

  const browserFallback = await generateSummary(
    cleaned.length >= 2 ? cleaned : [cleaned[0] || geoContext || 'Event', geoContext || 'Event context'],
    undefined,
    geoContext,
    lang,
    { skipCloudProviders: true, skipBrowserFallback: false },
  );
  if (browserFallback?.summary) {
    return {
      summary: browserFallback.summary,
      provider: browserFallback.provider,
      model: browserFallback.model,
      cached: browserFallback.cached,
    };
  }

  return null;
}
