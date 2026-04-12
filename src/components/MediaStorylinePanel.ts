import { Panel } from './Panel';
import { MediaDetailModal } from './MediaDetailModal';
import { getCurrentLanguage, t } from '@/services/i18n';
import { generateMediaTopicAnalysis } from '@/services/media-analysis';
import {
  getMediaBridgeItems,
  getMediaBridgeInterpretedKeys,
  getMediaBridgeInterpretedMeta,
  getMediaBridgeInterpretedSummaries,
  subscribeMediaBridgeInterpretation,
  subscribeMediaBridgeInterpretationMeta,
  subscribeMediaBridgeInterpretationSummaries,
  subscribeMediaBridgeItems,
} from '@/services/media-news-bridge';
import type { NewsItem } from '@/types';
import { escapeHtml } from '@/utils/sanitize';

interface TopicBucket {
  label: string;
  patterns: RegExp[];
}

const TOPIC_BUCKETS: TopicBucket[] = [
  {
    label: 'components.mediaStoryline.bucketPlatforms',
    patterns: [/platform/i, /algorithm/i, /distribution/i, /recommend/i, /平台/, /分发/, /推荐/, /流量/],
  },
  {
    label: 'components.mediaStoryline.bucketAi',
    patterns: [/ai/i, /model/i, /copyright/i, /synthetic/i, /人工智能/, /大模型/, /版权/, /AIGC/i],
  },
  {
    label: 'components.mediaStoryline.bucketAudience',
    patterns: [/creator/i, /influencer/i, /audience/i, /subscription/i, /创作者/, /粉丝/, /用户/, /订阅/],
  },
  {
    label: 'components.mediaStoryline.bucketPolicy',
    patterns: [/regulation/i, /law/i, /policy/i, /compliance/i, /监管/, /政策/, /法规/, /合规/],
  },
  {
    label: 'components.mediaStoryline.bucketBrand',
    patterns: [/advertis/i, /brand/i, /campaign/i, /marketing/i, /广告/, /品牌/, /营销/, /投放/],
  },
];

function hoursAgo(date: Date): number {
  return Math.max(0, (Date.now() - date.getTime()) / 3600000);
}

export class MediaStorylinePanel extends Panel {
  private items: NewsItem[] = [];
  private bridgeItems: NewsItem[] = getMediaBridgeItems();
  private interpretedKeys = getMediaBridgeInterpretedKeys();
  private interpretedMeta = getMediaBridgeInterpretedMeta();
  private interpretedSummaries = getMediaBridgeInterpretedSummaries();
  private modal = new MediaDetailModal();
  private unsubscribeBridge: (() => void) | null = null;
  private unsubscribeInterpretation: (() => void) | null = null;
  private unsubscribeInterpretationMeta: (() => void) | null = null;
  private unsubscribeInterpretationSummaries: (() => void) | null = null;

  constructor() {
    super({
      id: 'media-storyline',
      title: t('panels.mediaStoryline'),
      showCount: true,
      infoTooltip: t('components.mediaStoryline.infoTooltip'),
    });
    this.content.addEventListener('click', (event) => {
      const metricTrigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-storyline-metric]');
      if (metricTrigger) {
        event.preventDefault();
        const metric = metricTrigger.dataset.storylineMetric as 'topics' | 'alerts' | 'sources' | undefined;
        if (metric) this.openMetricDetail(metric);
        return;
      }

      const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-storyline-angle-index]');
      if (trigger) {
        event.preventDefault();
        const index = Number(trigger.dataset.storylineAngleIndex || -1);
        if (index >= 0) this.openAngleDetail(index);
        return;
      }

      const followUpTrigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-storyline-followup-index]');
      if (!followUpTrigger) return;
      event.preventDefault();
      const index = Number(followUpTrigger.dataset.storylineFollowupIndex || -1);
      if (index >= 0) this.openFollowUpDetail(index);
    });
    this.unsubscribeBridge = subscribeMediaBridgeItems((items) => {
      this.bridgeItems = items;
      this.renderPanel();
    });
    this.unsubscribeInterpretation = subscribeMediaBridgeInterpretation((keys) => {
      this.interpretedKeys = keys;
      this.renderPanel();
    });
    this.unsubscribeInterpretationMeta = subscribeMediaBridgeInterpretationMeta((meta) => {
      this.interpretedMeta = meta;
      this.renderPanel();
    });
    this.unsubscribeInterpretationSummaries = subscribeMediaBridgeInterpretationSummaries((summaries) => {
      this.interpretedSummaries = summaries;
      this.renderPanel();
    });
    this.renderPanel();
  }

  public updateData(items: NewsItem[]): void {
    this.items = [...items]
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      .slice(0, 180);
    this.renderPanel();
  }

  private renderPanel(): void {
    const recent = this.getMergedItems().filter((item) => hoursAgo(item.pubDate) <= 18);
    const trackedSources = new Set(recent.map((item) => item.source)).size;
    const criticalCount = recent.filter((item) => item.isAlert || item.threat?.level === 'critical' || item.threat?.level === 'high').length;
    const plannedAngles = this.buildAngles(recent);
    const followUps = recent.slice(0, 4);
    const recentAiBoostCount = recent.filter((item) => this.isFreshHighlightedItem(item)).length;

    this.setCount(plannedAngles.length);
    this.setContent(`
      <div style="display:grid;gap:12px">
        ${this.renderPulseStyles()}
        ${recentAiBoostCount > 0 ? `
          <div style="padding:10px 12px;border:1px solid rgba(16,185,129,0.36);border-radius:12px;background:linear-gradient(135deg, rgba(16,185,129,0.16), rgba(56,189,248,0.12));box-shadow:0 12px 30px rgba(16,185,129,0.12);animation:media-ai-pulse 1.5s ease-in-out 3">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <strong style="font-size:12px;color:#d1fae5">AI 解读已同步</strong>
              <span style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:10px;font-weight:700;color:#ecfeff;animation:media-ai-chip-pulse 1.2s ease-in-out 4">+${recentAiBoostCount}</span>
            </div>
            <div style="margin-top:4px;font-size:11px;line-height:1.5;color:rgba(236,253,245,0.92)">新增内容已推送到选题方向和快速跟进队列，带有 <strong style="color:#86efac">NEW</strong> 与 <strong style="color:#86efac">AI 已解读</strong> 标记。</div>
          </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${this.renderMetric('topics', t('components.mediaStoryline.metricTopics'), String(plannedAngles.length || 0), t('components.mediaStoryline.metricTopicsHint'))}
          ${this.renderMetric('alerts', t('components.mediaStoryline.metricAlerts'), String(criticalCount), t('components.mediaStoryline.metricAlertsHint'))}
          ${this.renderMetric('sources', t('components.mediaStoryline.metricSources'), String(trackedSources), t('components.mediaStoryline.metricSourcesHint'))}
        </div>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
            <strong style="font-size:12px">${escapeHtml(t('components.mediaStoryline.sectionAngles'))}</strong>
            <span style="font-size:10px;color:var(--text-dim)">${escapeHtml(this.formatToday())}</span>
          </div>
          <div style="display:grid;gap:8px">
            ${plannedAngles.length > 0
              ? plannedAngles.map((angle, index) => `
                <div style="display:flex;gap:10px;align-items:flex-start;${this.highlightBlockStyle(this.hasHighlightedRelatedItems(angle.relatedItems), this.hasFreshHighlightedRelatedItems(angle.relatedItems))}">
                  <span style="min-width:18px;height:18px;border-radius:999px;background:rgba(99,102,241,0.18);color:#c7d2fe;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${index + 1}</span>
                  <div style="min-width:0">
                    <button type="button" data-storyline-angle-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer">
                      <div style="font-size:12px;font-weight:600">${escapeHtml(angle.name)}${this.hasHighlightedRelatedItems(angle.relatedItems) ? `<span style="margin-left:6px;padding:2px 6px;border-radius:999px;background:rgba(16,185,129,0.18);color:#86efac;font-size:10px;font-weight:700;${this.hasFreshHighlightedRelatedItems(angle.relatedItems) ? 'animation:media-ai-chip-pulse 1.2s ease-in-out 4;' : ''}">AI 已解读</span>` : ''}</div>
                    </button>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${escapeHtml(t('components.mediaStoryline.angleMentions', { count: String(angle.count) }))}</div>
                  </div>
                </div>
              `).join('')
              : `<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('components.mediaStoryline.empty'))}</div>`}
          </div>
        </section>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaStoryline.sectionFollowUps'))}</strong>
          <div style="display:grid;gap:8px">
            ${followUps.length > 0
              ? followUps.map((item) => `
                <button
                  type="button"
                  data-storyline-followup-index="${followUps.indexOf(item)}"
                  style="padding:10px 12px;border:1px solid ${this.isHighlightedItem(item) ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.06)'};border-radius:12px;background:${this.isHighlightedItem(item) ? 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(56,189,248,0.10))' : 'none'};color:inherit;text-align:left;cursor:pointer;box-shadow:${this.isHighlightedItem(item) ? '0 0 0 1px rgba(16,185,129,0.12), 0 10px 24px rgba(16,185,129,0.08)' : 'none'};${this.isFreshHighlightedItem(item) ? 'animation:media-ai-pulse 1.5s ease-in-out 3;' : ''}"
                >
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
                    <div style="font-size:12px;line-height:1.45">${escapeHtml(item.title)}</div>
                    ${this.isHighlightedItem(item) ? `<span style="flex-shrink:0;padding:2px 6px;border-radius:999px;background:rgba(16,185,129,0.18);color:#86efac;font-size:10px;font-weight:700;${this.isFreshHighlightedItem(item) ? 'animation:media-ai-chip-pulse 1.2s ease-in-out 4;' : ''}">NEW</span>` : ''}
                  </div>
                  <div style="margin-top:4px;font-size:10px;color:var(--text-dim)">${escapeHtml(item.source)} · ${escapeHtml(this.relativeTime(item.pubDate))}</div>
                </button>
              `).join('')
              : `<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('components.mediaStoryline.empty'))}</div>`}
          </div>
        </section>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaStoryline.sectionWindows'))}</strong>
          <div style="display:grid;gap:8px">
            ${this.renderWindow('09:00', t('components.mediaStoryline.windowMorning'))}
            ${this.renderWindow('14:00', t('components.mediaStoryline.windowAfternoon'))}
            ${this.renderWindow('19:30', t('components.mediaStoryline.windowEvening'))}
          </div>
        </section>
      </div>
    `);
  }

  private buildAngles(items: NewsItem[]): Array<{ name: string; count: number; relatedItems: NewsItem[] }> {
    return TOPIC_BUCKETS
      .map((bucket) => ({
        name: t(bucket.label),
        relatedItems: items.filter((item) => bucket.patterns.some((pattern) => pattern.test(this.getMatchingText(item)))).slice(0, 6),
      }))
      .map((bucket) => ({
        ...bucket,
        count: bucket.relatedItems.length,
      }))
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }

  private openAngleDetail(index: number): void {
    const recent = this.getMergedItems().filter((item) => hoursAgo(item.pubDate) <= 18);
    const plannedAngles = this.buildAngles(recent);
    const angle = plannedAngles[index];
    if (!angle) return;

    const topSources = [...new Set(angle.relatedItems.map((item) => item.source))].slice(0, 4);
    this.modal.show({
      title: angle.name,
      subtitle: `近 18 小时内共命中 ${angle.count} 条信号，适合做选题指挥与后续拆解。`,
      tags: ['选题指挥板', ...topSources],
      sections: [
        {
          title: '基本情况',
          content: `该主题当前主要由 ${topSources.join('、') || '多来源'} 驱动，适合继续拆分为快讯、深度、评论和经营分析。`,
        },
        {
          title: '建议跟进方向',
          content: '优先判断平台动作是否会改变流量分发，其次观察品牌预算、创作者生态和监管表态是否同步变化。',
        },
      ],
      links: angle.relatedItems.slice(0, 5).map((item) => ({
        label: item.title,
        href: item.link,
        meta: `${item.source} · ${this.relativeTime(item.pubDate)}`,
      })),
      analysisTitle: 'AI 分析选题优势',
      analysisPromise: generateMediaTopicAnalysis(
        angle.name,
        angle.relatedItems.map((item) => ({ title: item.title, source: item.source })),
        'storyline',
      ),
    });
  }

  private openFollowUpDetail(index: number): void {
    const recent = this.getMergedItems().filter((item) => hoursAgo(item.pubDate) <= 18);
    const followUps = recent.slice(0, 4);
    const item = followUps[index];
    if (!item) return;

    const relatedItems = recent
      .filter((candidate) => candidate !== item && this.shareTopicBucket(item, candidate))
      .slice(0, 5);

    const tags = [
      '快速跟进队列',
      item.source,
      item.isAlert || item.threat?.level === 'critical' || item.threat?.level === 'high' ? '高优先级' : '持续跟进',
    ];

    this.modal.show({
      title: item.title,
      subtitle: `${item.source} · ${this.relativeTime(item.pubDate)}。适合快速转化为快讯、延伸稿或专题切口。`,
      tags,
      sections: [
        {
          title: '基本内容',
          content: this.buildFollowUpSummary(item, relatedItems),
        },
        {
          title: '建议跟进动作',
          content: '优先确认这条信号是单点事件还是行业趋势；再判断是否需要补平台策略、品牌预算、版权合规或用户增长角度。',
        },
      ],
      links: [
        {
          label: item.title,
          href: item.link,
          meta: `${item.source} · ${this.relativeTime(item.pubDate)}`,
        },
        ...relatedItems.map((related) => ({
          label: related.title,
          href: related.link,
          meta: `${related.source} · ${this.relativeTime(related.pubDate)}`,
        })),
      ],
      analysisTitle: 'AI 分析结果',
      analysisPromise: generateMediaTopicAnalysis(
        item.title,
        [item, ...relatedItems].map((news) => ({ title: news.title, source: news.source })),
        'storyline',
      ),
    });
  }

  private openMetricDetail(metric: 'topics' | 'alerts' | 'sources'): void {
    const recent = this.getMergedItems().filter((item) => hoursAgo(item.pubDate) <= 18);
    const plannedAngles = this.buildAngles(recent);
    const criticalItems = recent
      .filter((item) => item.isAlert || item.threat?.level === 'critical' || item.threat?.level === 'high')
      .slice(0, 8);
    const sources = [...new Set(recent.map((item) => item.source))];

    if (metric === 'topics') {
      this.modal.show({
        title: t('components.mediaStoryline.metricTopics'),
        subtitle: `当前共形成 ${plannedAngles.length} 个主线主题，点击下方链接可继续查看代表性信号。`,
        tags: ['主线主题', '选题指挥版'],
        sections: [
          {
            title: '基本内容',
            content: plannedAngles.length > 0
              ? plannedAngles.map((angle, index) => `${index + 1}. ${angle.name}（${angle.count} 条）`).join('；')
              : '当前暂无可用主线主题。',
          },
          {
            title: 'AI 分析建议',
            content: '优先选择跨来源重复出现、可延伸为快讯与深度稿的主题，避免只跟单一事件点。',
          },
        ],
        links: plannedAngles.flatMap((angle) => angle.relatedItems.slice(0, 2)).slice(0, 8).map((item) => ({
          label: item.title,
          href: item.link,
          meta: `${item.source} · ${this.relativeTime(item.pubDate)}`,
        })),
        analysisTitle: 'AI 分析主线主题',
        analysisPromise: generateMediaTopicAnalysis(
          '主线主题',
          plannedAngles.flatMap((angle) => angle.relatedItems).slice(0, 8).map((item) => ({ title: item.title, source: item.source })),
          'storyline',
        ),
      });
      return;
    }

    if (metric === 'alerts') {
      this.modal.show({
        title: t('components.mediaStoryline.metricAlerts'),
        subtitle: `近 18 小时共识别 ${criticalItems.length} 条高优先级线索，建议优先确认平台、监管或舆情影响。`,
        tags: ['高优先级线索', '快速跟进'],
        sections: [
          {
            title: '基本内容',
            content: criticalItems.length > 0
              ? criticalItems.map((item, index) => `${index + 1}. ${item.title}`).join('；')
              : '当前暂无高优先级线索。',
          },
          {
            title: '建议动作',
            content: '优先补充事件主体、时间线、影响对象与传播范围，再决定是否转成快讯或专题稿。',
          },
        ],
        links: criticalItems.map((item) => ({
          label: item.title,
          href: item.link,
          meta: `${item.source} · ${this.relativeTime(item.pubDate)}`,
        })),
        analysisTitle: 'AI 分析高优先级线索',
        analysisPromise: generateMediaTopicAnalysis(
          '高优先级线索',
          criticalItems.map((item) => ({ title: item.title, source: item.source })),
          'risk',
        ),
      });
      return;
    }

    this.modal.show({
      title: t('components.mediaStoryline.metricSources'),
      subtitle: `近 18 小时共覆盖 ${sources.length} 个独立来源，可用于判断主题扩散程度。`,
      tags: ['覆盖来源数', '来源监测'],
      sections: [
        {
          title: '覆盖来源',
          content: sources.length > 0 ? sources.join('、') : '当前暂无可用来源。',
        },
        {
          title: '观察建议',
          content: '优先关注是否已形成跨来源共振；若来源集中，说明主题仍处于早期发酵阶段。',
        },
      ],
      links: recent.slice(0, 8).map((item) => ({
        label: item.title,
        href: item.link,
        meta: `${item.source} · ${this.relativeTime(item.pubDate)}`,
      })),
      analysisTitle: 'AI 分析来源覆盖',
      analysisPromise: generateMediaTopicAnalysis(
        '覆盖来源数',
        recent.slice(0, 8).map((item) => ({ title: item.title, source: item.source })),
        'signal',
      ),
    });
  }

  private shareTopicBucket(base: NewsItem, candidate: NewsItem): boolean {
    const baseText = this.getMatchingText(base);
    const candidateText = this.getMatchingText(candidate);
    return TOPIC_BUCKETS.some((bucket) => bucket.patterns.some((pattern) => pattern.test(baseText)) && bucket.patterns.some((pattern) => pattern.test(candidateText)));
  }

  private buildFollowUpSummary(item: NewsItem, relatedItems: NewsItem[]): string {
    const relatedSources = [...new Set(relatedItems.map((news) => news.source))].slice(0, 3);
    const threatLabel = item.isAlert || item.threat?.level === 'critical' || item.threat?.level === 'high'
      ? '当前信号强度较高，适合优先跟进。'
      : '当前信号处于持续发酵阶段，适合做二次延展。';

    return [
      `核心线索来自 ${item.source}，标题聚焦“${item.title}”。`,
      relatedSources.length > 0 ? `同类信号还出现在 ${relatedSources.join('、')} 等来源，说明该议题已有跨源扩散迹象。` : '当前可先从原始报道切入，补充关联来源与平台反馈。',
      `${threatLabel} 建议优先确认事件主体、平台动作、商业影响和监管表态。`,
    ].join('');
  }

  private getMergedItems(): NewsItem[] {
    const seen = new Set<string>();
    return [...this.bridgeItems, ...this.items]
      .filter((item) => {
        const key = `${item.source}::${item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      .slice(0, 220);
  }

  public override destroy(): void {
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = null;
    this.unsubscribeInterpretation?.();
    this.unsubscribeInterpretation = null;
    this.unsubscribeInterpretationMeta?.();
    this.unsubscribeInterpretationMeta = null;
    this.unsubscribeInterpretationSummaries?.();
    this.unsubscribeInterpretationSummaries = null;
    super.destroy();
  }

  private isHighlightedItem(item: NewsItem): boolean {
    return this.interpretedKeys.has(`${item.source}::${item.title}`);
  }

  private hasHighlightedRelatedItems(items: NewsItem[]): boolean {
    return items.some((item) => this.isHighlightedItem(item));
  }

  private hasFreshHighlightedRelatedItems(items: NewsItem[]): boolean {
    return items.some((item) => this.isFreshHighlightedItem(item));
  }

  private isFreshHighlightedItem(item: NewsItem): boolean {
    const ts = this.interpretedMeta.get(`${item.source}::${item.title}`);
    return typeof ts === 'number' && Date.now() - ts <= 10 * 60 * 1000;
  }

  private highlightBlockStyle(active: boolean, fresh: boolean): string {
    if (!active) return '';
    return `padding:10px 12px;border-radius:14px;background:linear-gradient(135deg, rgba(16,185,129,0.14), rgba(59,130,246,0.10));box-shadow:0 0 0 1px rgba(16,185,129,0.16) inset, 0 12px 30px rgba(16,185,129,0.08);${fresh ? 'animation:media-ai-pulse 1.5s ease-in-out 3;' : ''}`;
  }

  private renderPulseStyles(): string {
    return `
      <style>
        @keyframes media-ai-pulse {
          0%, 100% { transform: translateZ(0); box-shadow: 0 0 0 1px rgba(16,185,129,0.12) inset, 0 10px 24px rgba(16,185,129,0.08); }
          50% { transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(52,211,153,0.32) inset, 0 16px 34px rgba(16,185,129,0.18); }
        }
        @keyframes media-ai-chip-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.14); }
        }
      </style>
    `;
  }

  private getMatchingText(item: NewsItem): string {
    const summary = this.interpretedSummaries.get(`${item.source}::${item.title}`) || '';
    return `${item.title} ${summary}`;
  }

  private renderMetric(metric: 'topics' | 'alerts' | 'sources', label: string, value: string, hint: string): string {
    return `
      <button type="button" data-storyline-metric="${metric}" style="padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03);color:inherit;text-align:left;cursor:pointer">
        <div style="font-size:10px;color:var(--text-dim)">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:10px;color:var(--text-dim)">${escapeHtml(hint)}</div>
      </button>
    `;
  }

  private renderWindow(time: string, text: string): string {
    return `
      <div style="display:flex;gap:10px;align-items:flex-start">
        <span style="min-width:46px;font-size:11px;font-weight:700;color:#93c5fd">${escapeHtml(time)}</span>
        <span style="font-size:11px;color:var(--text-dim);line-height:1.5">${escapeHtml(text)}</span>
      </div>
    `;
  }

  private relativeTime(date: Date): string {
    const hours = hoursAgo(date);
    if (hours < 1) return t('components.mediaStoryline.justNow');
    if (hours < 24) return t('components.mediaStoryline.hoursAgo', { count: String(Math.floor(hours)) });
    return t('components.mediaStoryline.daysAgo', { count: String(Math.floor(hours / 24)) });
  }

  private formatToday(): string {
    const locale = getCurrentLanguage() === 'zh' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date());
  }
}
