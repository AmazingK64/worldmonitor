import { Panel } from './Panel';
import { fetchMediaTavilyNews, summarizeMediaNewsItem, type MediaTavilyNewsItem } from '@/services/media-tavily-news';
import { MediaDetailModal } from './MediaDetailModal';
import {
  getMediaBridgeInterpretedKeys,
  getMediaBridgeInterpretedMeta,
  markMediaBridgeInterpreted,
  setMediaBridgeItems,
  subscribeMediaBridgeInterpretation,
  subscribeMediaBridgeInterpretationMeta,
} from '@/services/media-news-bridge';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import type { NewsItem } from '@/types';

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export class MediaTavilyNewsPanel extends Panel {
  private items: MediaTavilyNewsItem[] = [];
  private expanded = new Map<string, string>();
  private didRetry = false;
  private loadingIndexes = new Set<number>();
  private interpretedKeys = getMediaBridgeInterpretedKeys();
  private interpretedMeta = getMediaBridgeInterpretedMeta();
  private unsubscribeInterpretation: (() => void) | null = null;
  private unsubscribeInterpretationMeta: (() => void) | null = null;
  private modal = new MediaDetailModal();

  constructor() {
    super({
      id: 'media-tavily-news',
      title: 'Tavily 媒体新闻',
      showCount: true,
      infoTooltip: '使用 Tavily 获取最近 7 天的媒体行业新闻，并可逐条生成 AI 解读。',
    });
    this.content.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const reloadBtn = target?.closest<HTMLButtonElement>('[data-media-news-reload]');
      if (reloadBtn) {
        event.preventDefault();
        event.stopPropagation();
        void this.load();
        return;
      }

      const aiBtn = target?.closest<HTMLButtonElement>('[data-ai-news-index]');
      if (!aiBtn) return;
      event.preventDefault();
      event.stopPropagation();
      const index = Number(aiBtn.dataset.aiNewsIndex || -1);
      if (index < 0) return;
      void this.handleAiClick(index, aiBtn);
    });
    this.unsubscribeInterpretation = subscribeMediaBridgeInterpretation((keys) => {
      this.interpretedKeys = keys;
      this.renderPanel();
    });
    this.unsubscribeInterpretationMeta = subscribeMediaBridgeInterpretationMeta((meta) => {
      this.interpretedMeta = meta;
      this.renderPanel();
    });
    this.renderLoading();
    void this.load();
  }

  public async load(): Promise<void> {
    try {
      this.showLoading();
      const result = await fetchMediaTavilyNews(8, 7);
      this.items = result.items;
      if (this.items.length === 0 && !this.didRetry) {
        this.didRetry = true;
        const retryResult = await fetchMediaTavilyNews(12, 14);
        this.items = retryResult.items;
      }
      setMediaBridgeItems(this.items.map((item) => this.toNewsItem(item)));
      this.setCount(this.items.length);
      this.renderPanel();
    } catch (error) {
      setMediaBridgeItems([]);
      const message = error instanceof Error ? error.message : 'Failed to load';
      this.showError(message, () => { void this.load(); });
    }
  }

  private renderLoading(): void {
    this.setContent(`<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('common.loading'))}</div>`);
  }

  private renderPanel(): void {
    this.setContent(`
      <div style="display:grid;gap:10px">
        ${this.renderPulseStyles()}
        ${this.items.length > 0 ? this.items.map((item, index) => this.renderItem(item, index)).join('') : `
          <div style="display:grid;gap:8px">
            <div style="font-size:12px;color:var(--text-dim)">当前未获取到 Tavily 媒体新闻。</div>
            <button type="button" data-media-news-reload class="panel-locked-cta" style="justify-self:start">重新加载</button>
          </div>
        `}
      </div>
    `);
  }

  private async handleAiClick(index: number, button: HTMLButtonElement): Promise<void> {
    const item = this.items[index];
    if (!item || this.loadingIndexes.has(index)) return;

    const cacheKey = item.url || item.title;
    const relatedItems = this.items
      .filter((candidate, candidateIndex) => candidateIndex !== index && this.shareTopic(item, candidate))
      .slice(0, 5);

    if (this.expanded.has(cacheKey)) {
      this.openDetailModal(item, this.expanded.get(cacheKey) || '', relatedItems);
      return;
    }

    this.loadingIndexes.add(index);
    button.disabled = true;
    button.textContent = '…';

    this.openLoadingModal(item, relatedItems);

    try {
      const result = await summarizeMediaNewsItem(item);
      const summary = result || '当前无法生成 AI 解读。';
      this.expanded.set(cacheKey, summary);
      markMediaBridgeInterpreted({ source: item.source, title: item.title });
      this.openDetailModal(item, summary, relatedItems);
    } catch {
      this.openDetailModal(item, '当前无法生成 AI 解读。', relatedItems);
    } finally {
      this.loadingIndexes.delete(index);
      button.disabled = false;
      button.textContent = '✨';
    }
  }

  private renderItem(item: MediaTavilyNewsItem, index: number): string {
    const safeUrl = sanitizeUrl(item.url);
    const interpreted = this.isInterpreted(item);
    const fresh = this.isFreshInterpreted(item);
    const buttonLabel = this.loadingIndexes.has(index) ? '…' : interpreted ? '已同步' : 'AI 解读';
    const buttonStyle = this.loadingIndexes.has(index)
      ? 'border:1px solid rgba(148,163,184,0.28);background:rgba(148,163,184,0.12);color:#cbd5e1;cursor:wait;'
      : interpreted
        ? `border:1px solid rgba(16,185,129,0.4);background:linear-gradient(135deg, rgba(16,185,129,0.18), rgba(56,189,248,0.14));color:#d1fae5;${fresh ? 'animation:media-ai-sync-pulse 1.4s ease-in-out 3;' : ''}`
        : 'border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text);';
    return `
      <article style="padding:10px 12px;border:1px solid ${interpreted ? 'rgba(16,185,129,0.2)' : 'var(--border)'};border-radius:12px;background:${interpreted ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(56,189,248,0.06))' : 'rgba(255,255,255,0.03)'};box-shadow:${interpreted ? '0 10px 24px rgba(16,185,129,0.06)' : 'none'};${fresh ? 'animation:media-ai-card-pulse 1.5s ease-in-out 3;' : ''}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <a href="${safeUrl}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;line-height:1.45;text-decoration:none;color:var(--text)">
            ${escapeHtml(item.title)}
          </a>
          <button type="button" data-ai-news-index="${index}" title="${interpreted ? '查看已同步的 AI 解读' : 'AI 解读'}" style="flex-shrink:0;padding:6px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.02em;${buttonStyle}">${escapeHtml(buttonLabel)}</button>
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--text-dim)">${escapeHtml(item.source)} · ${escapeHtml(relativeTime(item.publishedAt))}${interpreted ? '<span style="margin-left:8px;color:#86efac;font-weight:700">已同步到选题 / 雷达</span>' : ''}</div>
        ${item.summary ? `<div style="margin-top:8px;font-size:11px;color:var(--text-dim);line-height:1.5">${escapeHtml(item.summary.slice(0, 180))}</div>` : ''}
      </article>
    `;
  }

  private openLoadingModal(item: MediaTavilyNewsItem, relatedItems: MediaTavilyNewsItem[]): void {
    this.modal.show({
      title: item.title,
      subtitle: `${item.source} · ${relativeTime(item.publishedAt)}。正在生成 AI 解读，并同步转化为监测主题与选题线索。`,
      tags: ['Tavily 媒体新闻', item.source, 'AI 解读'],
      sections: [
        {
          title: '基础内容',
          content: item.summary || '该新闻未附带摘要，建议结合原文与关联报道判断平台动作、受众反馈和商业影响。',
        },
        {
          title: '联动说明',
          content: '这条新闻会被纳入传媒监测主题与选题指挥板，便于后续在经营雷达和快速跟进队列中继续追踪。',
        },
      ],
      links: [
        {
          label: item.title,
          href: item.url,
          meta: item.source,
        },
        ...relatedItems.map((related) => ({
          label: related.title,
          href: related.url,
          meta: `${related.source} · ${relativeTime(related.publishedAt)}`,
        })),
      ],
      analysisTitle: 'AI 解读',
      analysisLoadingText: 'AI 解读生成中...',
      analysisPromise: Promise.resolve('AI 解读生成中...'),
    });
  }

  private openDetailModal(item: MediaTavilyNewsItem, summary: string, relatedItems: MediaTavilyNewsItem[]): void {
    this.modal.show({
      title: item.title,
      subtitle: `${item.source} · ${relativeTime(item.publishedAt)}。该新闻已同步纳入监测主题与选题指挥版。`,
      tags: ['Tavily 媒体新闻', item.source, '已转化'],
      sections: [
        {
          title: '基础内容',
          content: item.summary || '该新闻未附带摘要，建议结合原文继续确认平台动作、品牌预算与传播影响。',
        },
        {
          title: '转化结果',
          content: '该新闻已作为传媒信号并入监测主题、选题指挥板和经营雷达，可继续从平台分发、AI版权、创作者生态、品牌舆情等方向拆解。',
        },
      ],
      links: [
        {
          label: item.title,
          href: item.url,
          meta: item.source,
        },
        ...relatedItems.map((related) => ({
          label: related.title,
          href: related.url,
          meta: `${related.source} · ${relativeTime(related.publishedAt)}`,
        })),
      ],
      analysisTitle: 'AI 解读',
      analysisPromise: Promise.resolve(summary),
    });
  }

  private shareTopic(base: MediaTavilyNewsItem, candidate: MediaTavilyNewsItem): boolean {
    const patterns = [
      /platform|algorithm|distribution|recommend|youtube|tiktok|platform|平台|分发|推荐|流量/i,
      /ai|model|copyright|synthetic|人工智能|大模型|版权|AIGC/i,
      /creator|audience|subscription|influencer|创作者|用户|订阅|粉丝/i,
      /advertis|brand|campaign|marketing|广告|品牌|投放|营销/i,
      /regulation|policy|law|compliance|监管|政策|法规|合规/i,
      /entertainment|celebrity|drama|movie|music|gaming|文娱|影视|综艺|音乐|游戏|热点/i,
    ];
    return patterns.some((pattern) => pattern.test(base.title) && pattern.test(candidate.title));
  }

  private toNewsItem(item: MediaTavilyNewsItem): NewsItem {
    return {
      source: item.source,
      title: item.title,
      link: item.url,
      pubDate: new Date(item.publishedAt),
      isAlert: /regulation|ban|lawsuit|copyright|layoff|boycott|crisis|监管|封禁|诉讼|版权|裁员|危机/i.test(item.title),
      threat: {
        level: /ban|lawsuit|crisis|boycott|监管|封禁|诉讼|危机/i.test(item.title) ? 'high' : /ai|platform|advertis|creator|文娱|热点/i.test(item.title) ? 'medium' : 'low',
        category: 'general',
        confidence: 0.72,
        source: 'keyword',
      },
      storyMeta: {
        firstSeen: item.publishedAt,
        mentionCount: 1,
        sourceCount: 1,
        phase: 'developing',
      },
    };
  }

  public override destroy(): void {
    this.unsubscribeInterpretation?.();
    this.unsubscribeInterpretation = null;
    this.unsubscribeInterpretationMeta?.();
    this.unsubscribeInterpretationMeta = null;
    super.destroy();
  }

  private isInterpreted(item: MediaTavilyNewsItem): boolean {
    return this.interpretedKeys.has(`${item.source}::${item.title}`);
  }

  private isFreshInterpreted(item: MediaTavilyNewsItem): boolean {
    const ts = this.interpretedMeta.get(`${item.source}::${item.title}`);
    return typeof ts === 'number' && Date.now() - ts <= 10 * 60 * 1000;
  }

  private renderPulseStyles(): string {
    return `
      <style>
        @keyframes media-ai-sync-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.04); filter: brightness(1.08); }
        }
        @keyframes media-ai-card-pulse {
          0%, 100% { transform: translateZ(0); box-shadow: 0 10px 24px rgba(16,185,129,0.06); }
          50% { transform: translateY(-1px); box-shadow: 0 16px 34px rgba(16,185,129,0.14); }
        }
      </style>
    `;
  }
}
