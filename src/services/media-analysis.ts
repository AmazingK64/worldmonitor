import { SITE_VARIANT } from '@/config';
import { NewsServiceClient } from '@/generated/client/worldmonitor/news/v1/service_client';
import { getCurrentLanguage } from '@/services/i18n';
import { getRpcBaseUrl } from '@/services/rpc-client';
import { isFeatureAvailable } from '@/services/runtime-config';
import { generateSummary } from '@/services/summarization';

interface MediaAnalysisItem {
  title: string;
  source?: string;
  summary?: string;
}

type AnalysisFocus = 'storyline' | 'opportunity' | 'risk' | 'signal';

const newsClient = new NewsServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const PROVIDERS: Array<{ featureId: 'aiOllama' | 'aiGroq' | 'aiOpenRouter'; provider: 'ollama' | 'groq' | 'openrouter' }> = [
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

function buildFallback(topic: string, items: MediaAnalysisItem[], focus: AnalysisFocus): string {
  const sourceCount = new Set(items.map((item) => item.source).filter(Boolean)).size;
  const headlineCount = items.length;
  const focusLine = focus === 'risk'
    ? '这类主题更适合做风险提示与情境追踪，便于提前解释平台、监管或商业化波动对媒体业务的冲击。'
    : focus === 'opportunity'
      ? '这类主题更适合做机会挖掘，能够延展到平台策略、广告预算、创作者生态和经营增量。'
      : '这类主题适合做持续跟踪，既能承接当下热点，也能自然延展为后续报道与经营判断。';
  return `${topic} 当前至少关联 ${headlineCount} 条信号，覆盖 ${Math.max(sourceCount, 1)} 个来源。${focusLine} 选题优势在于可同时连接受众关注、平台分发变化和商业价值判断，适合继续拆分为快讯、深度和经营分析三种内容形态。`;
}

export async function generateMediaTopicAnalysis(
  topic: string,
  items: MediaAnalysisItem[],
  focus: AnalysisFocus,
): Promise<string> {
  const headlines = items
    .map((item) => item.title.trim())
    .filter(Boolean)
    .slice(0, 6);

  const context = [
    `Topic: ${topic}`,
    `Focus: ${focus}`,
    'Analyze this topic for a media operator.',
    'Explain why it matters, what editorial or business value it has, and what follow-up angle is most worth pursuing.',
    ...items.slice(0, 4).map((item) => `Source ${item.source || 'Unknown'}: ${(item.summary || item.title).slice(0, 160)}`),
  ].join('\n');

  for (const provider of PROVIDERS) {
    if (!isFeatureAvailable(provider.featureId)) continue;
    try {
      const resp = await withTimeout(newsClient.summarizeArticle({
        provider: provider.provider,
        headlines: headlines.length > 0 ? headlines : [topic],
        mode: 'analysis',
        geoContext: context,
        variant: SITE_VARIANT === 'media' ? 'media' : SITE_VARIANT,
        lang: getCurrentLanguage(),
        systemAppend: '',
      }), 14_000);

      if (resp.status === 'SUMMARIZE_STATUS_SKIPPED' || resp.fallback) continue;
      const summary = typeof resp.summary === 'string' ? resp.summary.trim() : '';
      if (summary.length >= 20) return summary;
    } catch {
      // Try next provider.
    }
  }

  const browserFallback = await generateSummary(
    headlines.length >= 2 ? headlines : [topic, ...headlines],
    undefined,
    context,
    getCurrentLanguage(),
    { skipCloudProviders: true, skipBrowserFallback: false },
  );
  if (browserFallback?.summary) return browserFallback.summary;

  return buildFallback(topic, items, focus);
}
