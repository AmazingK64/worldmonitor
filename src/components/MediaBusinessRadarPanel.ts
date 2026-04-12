import { Panel } from './Panel';
import { MediaDetailModal } from './MediaDetailModal';
import { t } from '@/services/i18n';
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

interface RadarBucket {
  labelKey: string;
  hintKey: string;
  patterns: RegExp[];
}

const RADAR_BUCKETS: RadarBucket[] = [
  {
    labelKey: 'components.mediaBusinessRadar.bucketRevenue',
    hintKey: 'components.mediaBusinessRadar.bucketRevenueHint',
    patterns: [/advertis/i, /brand/i, /subscription/i, /paywall/i, /广告/, /品牌/, /会员/, /订阅/, /付费/],
  },
  {
    labelKey: 'components.mediaBusinessRadar.bucketPlatforms',
    hintKey: 'components.mediaBusinessRadar.bucketPlatformsHint',
    patterns: [/platform/i, /algorithm/i, /distribution/i, /youtube/i, /tiktok/i, /平台/, /分发/, /短视频/, /推荐/],
  },
  {
    labelKey: 'components.mediaBusinessRadar.bucketPolicy',
    hintKey: 'components.mediaBusinessRadar.bucketPolicyHint',
    patterns: [/regulation/i, /copyright/i, /compliance/i, /policy/i, /监管/, /版权/, /政策/, /合规/],
  },
  {
    labelKey: 'components.mediaBusinessRadar.bucketAi',
    hintKey: 'components.mediaBusinessRadar.bucketAiHint',
    patterns: [/ai/i, /model/i, /automation/i, /synthetic/i, /人工智能/, /大模型/, /自动化/, /AIGC/i],
  },
];

export class MediaBusinessRadarPanel extends Panel {
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
      id: 'media-business-radar',
      title: t('panels.mediaBusinessRadar'),
      showCount: true,
      infoTooltip: t('components.mediaBusinessRadar.infoTooltip'),
    });
    this.content.addEventListener('click', (event) => {
      const metricTrigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-radar-metric]');
      if (metricTrigger) {
        event.preventDefault();
        const metric = metricTrigger.dataset.radarMetric as 'signals' | 'opportunities' | 'risks' | undefined;
        if (metric) this.openMetricDetail(metric);
        return;
      }

      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-radar-role][data-radar-index]');
      if (!target) return;
      event.preventDefault();
      const index = Number(target.dataset.radarIndex || -1);
      const role = target.dataset.radarRole as 'signal' | 'opportunity' | 'risk' | undefined;
      if (index >= 0 && role) this.openRadarDetail(role, index);
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
    const mergedItems = this.getMergedItems();
    const ranked = RADAR_BUCKETS
      .map((bucket) => ({
        name: t(bucket.labelKey),
        hint: t(bucket.hintKey),
        relatedItems: mergedItems.filter((item) => bucket.patterns.some((pattern) => pattern.test(this.getMatchingText(item)))).slice(0, 6),
      }))
      .map((bucket) => ({ ...bucket, count: bucket.relatedItems.length }))
      .sort((a, b) => b.count - a.count);

    const topSignals = ranked.slice(0, 3);
    const riskItems = mergedItems
      .filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical')
      .slice(0, 5);
    const opportunityCount = ranked.filter((item) => item.count >= 3).length;
    const watchCount = ranked.filter((item) => item.count > 0).length;
    const riskCount = mergedItems.filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical').length;
    const recentAiBoostCount = mergedItems.filter((item) => this.isFreshHighlightedItem(item)).length;

    this.setCount(watchCount);
    this.setContent(`
      <div style="display:grid;gap:12px">
        ${this.renderPulseStyles()}
        ${recentAiBoostCount > 0 ? `
          <div style="padding:10px 12px;border:1px solid rgba(16,185,129,0.36);border-radius:12px;background:linear-gradient(135deg, rgba(16,185,129,0.16), rgba(251,191,36,0.12));box-shadow:0 12px 30px rgba(16,185,129,0.12);animation:media-ai-radar-pulse 1.5s ease-in-out 3">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <strong style="font-size:12px;color:#ecfccb">AI 解读已写入经营雷达</strong>
              <span style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:10px;font-weight:700;color:#fef3c7;animation:media-ai-radar-chip-pulse 1.2s ease-in-out 4">+${recentAiBoostCount}</span>
            </div>
            <div style="margin-top:4px;font-size:11px;line-height:1.5;color:rgba(254,252,232,0.92)">新增内容已同步到检测主题、机会主题和风险事项，相关卡片会显示强化高亮。</div>
          </div>
        ` : ''}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${this.metricCard('signals', t('components.mediaBusinessRadar.metricSignals'), String(watchCount), t('components.mediaBusinessRadar.metricSignalsHint'))}
          ${this.metricCard('opportunities', t('components.mediaBusinessRadar.metricOpportunities'), String(opportunityCount), t('components.mediaBusinessRadar.metricOpportunitiesHint'))}
          ${this.metricCard('risks', t('components.mediaBusinessRadar.metricRisks'), String(riskCount), t('components.mediaBusinessRadar.metricRisksHint'))}
        </div>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaBusinessRadar.sectionRadar'))}</strong>
          <div style="display:grid;gap:8px">
            ${ranked.map((item, index) => `
              <div style="display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;${this.highlightContainerStyle(this.hasHighlightedRelatedItems(item.relatedItems), this.hasFreshHighlightedRelatedItems(item.relatedItems))}">
                <button type="button" data-radar-role="signal" data-radar-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;font-size:11px">${escapeHtml(item.name)}</button>
                <div style="height:6px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden">
                  <div style="width:${Math.min(100, item.count * 18)}%;height:100%;background:linear-gradient(90deg,#38bdf8,#f59e0b)"></div>
                </div>
                <span style="font-size:11px;color:var(--text-dim);${this.hasFreshHighlightedRelatedItems(item.relatedItems) ? 'animation:media-ai-radar-chip-pulse 1.2s ease-in-out 4;' : ''}">${escapeHtml(String(item.count))}${this.hasHighlightedRelatedItems(item.relatedItems) ? ' · AI' : ''}</span>
              </div>
            `).join('')}
          </div>
        </section>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaBusinessRadar.sectionActions'))}</strong>
          <div style="display:grid;gap:8px">
            ${topSignals.length > 0
              ? topSignals.map((item, index) => `
                <div style="padding:10px 12px;border:1px solid ${this.hasHighlightedRelatedItems(item.relatedItems) ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.06)'};border-radius:12px;background:${this.hasHighlightedRelatedItems(item.relatedItems) ? 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(251,191,36,0.10))' : 'none'};box-shadow:${this.hasHighlightedRelatedItems(item.relatedItems) ? '0 10px 24px rgba(16,185,129,0.08)' : 'none'};${this.hasFreshHighlightedRelatedItems(item.relatedItems) ? 'animation:media-ai-radar-pulse 1.5s ease-in-out 3;' : ''}">
                  <button type="button" data-radar-role="opportunity" data-radar-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;font-size:12px;font-weight:600">${escapeHtml(item.name)}</button>
                  <div style="margin-top:3px;font-size:11px;color:var(--text-dim);line-height:1.5">${escapeHtml(item.hint)}</div>
                </div>
              `).join('')
              : `<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('components.mediaBusinessRadar.empty'))}</div>`}
          </div>
        </section>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">风险事项</strong>
          <div style="display:grid;gap:8px">
            ${riskItems.length > 0
              ? riskItems.map((item, index) => `
                <div style="padding:10px 12px;border:1px solid ${this.isHighlightedItem(item) ? 'rgba(248,113,113,0.45)' : 'rgba(255,255,255,0.06)'};border-radius:12px;background:${this.isHighlightedItem(item) ? 'linear-gradient(135deg, rgba(248,113,113,0.14), rgba(251,191,36,0.10))' : 'none'};box-shadow:${this.isHighlightedItem(item) ? '0 10px 24px rgba(248,113,113,0.08)' : 'none'};${this.isFreshHighlightedItem(item) ? 'animation:media-ai-risk-pulse 1.5s ease-in-out 3;' : ''}">
                  <button type="button" data-radar-role="risk" data-radar-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;font-size:12px;font-weight:600;line-height:1.45">${escapeHtml(item.title)}</button>
                  <div style="margin-top:3px;font-size:10px;color:var(--text-dim)">${escapeHtml(item.source)}</div>
                </div>
              `).join('')
              : `<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('components.mediaBusinessRadar.empty'))}</div>`}
          </div>
        </section>
      </div>
    `);
  }

  private metricCard(metric: 'signals' | 'opportunities' | 'risks', label: string, value: string, hint: string): string {
    return `
      <button type="button" data-radar-metric="${metric}" style="padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03);color:inherit;text-align:left;cursor:pointer">
        <div style="font-size:10px;color:var(--text-dim)">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:10px;color:var(--text-dim)">${escapeHtml(hint)}</div>
      </button>
    `;
  }

  private openMetricDetail(metric: 'signals' | 'opportunities' | 'risks'): void {
    const mergedItems = this.getMergedItems();
    const ranked = RADAR_BUCKETS
      .map((bucket) => ({
        name: t(bucket.labelKey),
        hint: t(bucket.hintKey),
        relatedItems: mergedItems.filter((item) => bucket.patterns.some((pattern) => pattern.test(this.getMatchingText(item)))).slice(0, 6),
      }))
      .map((bucket) => ({ ...bucket, count: bucket.relatedItems.length }))
      .sort((a, b) => b.count - a.count);
    const topSignals = ranked.slice(0, 5);
    const opportunityItems = ranked.filter((item) => item.count >= 3).slice(0, 5);
    const riskItems = mergedItems
      .filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical')
      .slice(0, 8);

    if (metric === 'signals') {
      this.modal.show({
        title: t('components.mediaBusinessRadar.metricSignals'),
        subtitle: `当前共识别 ${topSignals.length} 个监测主题，可用于判断业务关注重心。`,
        tags: ['监测主题', '经营雷达'],
        sections: [
          {
            title: '基本内容',
            content: topSignals.length > 0
              ? topSignals.map((item, index) => `${index + 1}. ${item.name}（${item.count} 条）`).join('；')
              : '当前暂无监测主题。',
          },
          {
            title: '观察建议',
            content: '优先看平台分发、AI 版权、品牌预算和监管表态是否共同变化，这些更容易带来业务动作。',
          },
        ],
        links: topSignals.flatMap((item) => item.relatedItems.slice(0, 2)).slice(0, 8).map((item) => ({
          label: item.title,
          href: item.link,
          meta: item.source,
        })),
        analysisTitle: 'AI 分析监测主题',
        analysisPromise: generateMediaTopicAnalysis(
          '监测主题',
          topSignals.flatMap((item) => item.relatedItems).slice(0, 8).map((item) => ({ title: item.title, source: item.source })),
          'signal',
        ),
      });
      return;
    }

    if (metric === 'opportunities') {
      this.modal.show({
        title: t('components.mediaBusinessRadar.metricOpportunities'),
        subtitle: `当前共形成 ${opportunityItems.length} 个机会主题，适合做连续策划和经营判断。`,
        tags: ['机会主题', '经营机会'],
        sections: [
          {
            title: '基本内容',
            content: opportunityItems.length > 0
              ? opportunityItems.map((item, index) => `${index + 1}. ${item.name}（${item.count} 条）`).join('；')
              : '当前暂无成型的机会主题。',
          },
          {
            title: 'AI 分析建议',
            content: '优先筛选可同时支撑流量、品牌合作和长期栏目策划的主题，避免只做一次性热点消耗。',
          },
        ],
        links: opportunityItems.flatMap((item) => item.relatedItems.slice(0, 2)).slice(0, 8).map((item) => ({
          label: item.title,
          href: item.link,
          meta: item.source,
        })),
        analysisTitle: 'AI 分析机会主题',
        analysisPromise: generateMediaTopicAnalysis(
          '机会主题',
          opportunityItems.flatMap((item) => item.relatedItems).slice(0, 8).map((item) => ({ title: item.title, source: item.source })),
          'opportunity',
        ),
      });
      return;
    }

    this.modal.show({
      title: t('components.mediaBusinessRadar.metricRisks'),
      subtitle: `当前共识别 ${riskItems.length} 条风险事项，建议优先确认影响对象与传播范围。`,
      tags: ['风险事项', '风险评估'],
      sections: [
        {
          title: '基本内容',
          content: riskItems.length > 0
            ? riskItems.map((item, index) => `${index + 1}. ${item.title}`).join('；')
            : '当前暂无高优先级风险事项。',
        },
        {
          title: '处置建议',
          content: '优先核实事件真实性、涉及平台和品牌，再判断是内部预警、风险提示还是公开选题。',
        },
      ],
      links: riskItems.map((item) => ({
        label: item.title,
        href: item.link,
        meta: item.source,
      })),
      analysisTitle: 'AI 分析风险事项',
      analysisPromise: generateMediaTopicAnalysis(
        '风险事项',
        riskItems.map((item) => ({ title: item.title, source: item.source })),
        'risk',
      ),
    });
  }

  private openRadarDetail(role: 'signal' | 'opportunity' | 'risk', index: number): void {
    const mergedItems = this.getMergedItems();
    const ranked = RADAR_BUCKETS
      .map((bucket) => ({
        name: t(bucket.labelKey),
        hint: t(bucket.hintKey),
        relatedItems: mergedItems.filter((item) => bucket.patterns.some((pattern) => pattern.test(item.title))).slice(0, 6),
      }))
      .map((bucket) => ({ ...bucket, count: bucket.relatedItems.length }))
      .sort((a, b) => b.count - a.count);
    const riskItems = mergedItems
      .filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical')
      .slice(0, 5);

    if (role === 'risk') {
      const item = riskItems[index];
      if (!item) return;
      this.modal.show({
        title: '风险事项',
        subtitle: '该条信号已被识别为高优先级风险，建议进一步做平台、品牌与舆情影响评估。',
        tags: ['风险事项', item.source],
        sections: [
          { title: '事件内容', content: item.title },
          { title: '处置建议', content: '优先核实事件真实性、受影响平台与品牌对象，再判断是否需要做快讯、背景稿和风险提示。' },
        ],
        links: [{ label: item.title, href: item.link, meta: item.source }],
        analysisTitle: 'AI 分析风险影响',
        analysisPromise: generateMediaTopicAnalysis(
          item.title,
          [{ title: item.title, source: item.source }],
          'risk',
        ),
      });
      return;
    }

    const sourceList = role === 'opportunity'
      ? ranked.filter((item) => item.count >= 3).slice(0, 3)
      : ranked;
    const item = sourceList[index];
    if (!item) return;
    const focus = role === 'opportunity' ? 'opportunity' : 'signal';
    this.modal.show({
      title: item.name,
      subtitle: role === 'opportunity' ? '该主题已形成较明确机会窗口，适合做连续策划。' : '该主题正在进入经营观察雷达，适合结合业务判断继续跟踪。',
      tags: [role === 'opportunity' ? '机会主题' : '检测主题'],
      sections: [
        { title: '基本内容', content: item.hint },
        { title: '观察重点', content: '建议同步关注平台动作、品牌预算变化、创作者反馈和监管表态，避免只看单一新闻点。 ' },
      ],
      links: item.relatedItems.slice(0, 5).map((related) => ({
        label: related.title,
        href: related.link,
        meta: `${related.source}`,
      })),
      analysisTitle: role === 'opportunity' ? 'AI 分析机会价值' : 'AI 分析主题意义',
      analysisPromise: generateMediaTopicAnalysis(
        item.name,
        item.relatedItems.map((related) => ({ title: related.title, source: related.source })),
        focus,
      ),
    });
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

  private highlightContainerStyle(active: boolean, fresh: boolean): string {
    if (!active) return '';
    return `background:linear-gradient(135deg, rgba(16,185,129,0.14), rgba(56,189,248,0.10));box-shadow:0 0 0 1px rgba(16,185,129,0.16) inset;${fresh ? 'animation:media-ai-radar-pulse 1.5s ease-in-out 3;' : ''}`;
  }

  private isFreshHighlightedItem(item: NewsItem): boolean {
    const ts = this.interpretedMeta.get(`${item.source}::${item.title}`);
    return typeof ts === 'number' && Date.now() - ts <= 10 * 60 * 1000;
  }

  private renderPulseStyles(): string {
    return `
      <style>
        @keyframes media-ai-radar-pulse {
          0%, 100% { transform: translateZ(0); box-shadow: 0 0 0 1px rgba(16,185,129,0.14) inset, 0 10px 24px rgba(16,185,129,0.08); }
          50% { transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(74,222,128,0.34) inset, 0 16px 34px rgba(16,185,129,0.16); }
        }
        @keyframes media-ai-risk-pulse {
          0%, 100% { transform: translateZ(0); box-shadow: 0 10px 24px rgba(248,113,113,0.08); }
          50% { transform: translateY(-1px); box-shadow: 0 18px 36px rgba(248,113,113,0.16); }
        }
        @keyframes media-ai-radar-chip-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.12); }
        }
      </style>
    `;
  }

  private getMatchingText(item: NewsItem): string {
    const summary = this.interpretedSummaries.get(`${item.source}::${item.title}`) || '';
    return `${item.title} ${summary}`;
  }
}
