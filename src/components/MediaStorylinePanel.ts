import { Panel } from './Panel';
import { MediaDetailModal } from './MediaDetailModal';
import { getCurrentLanguage, t } from '@/services/i18n';
import { generateMediaTopicAnalysis } from '@/services/media-analysis';
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
  private modal = new MediaDetailModal();

  constructor() {
    super({
      id: 'media-storyline',
      title: t('panels.mediaStoryline'),
      showCount: true,
      infoTooltip: t('components.mediaStoryline.infoTooltip'),
    });
    this.content.addEventListener('click', (event) => {
      const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-storyline-angle-index]');
      if (!trigger) return;
      event.preventDefault();
      const index = Number(trigger.dataset.storylineAngleIndex || -1);
      if (index >= 0) this.openAngleDetail(index);
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
    const recent = this.items.filter((item) => hoursAgo(item.pubDate) <= 18);
    const trackedSources = new Set(recent.map((item) => item.source)).size;
    const criticalCount = recent.filter((item) => item.isAlert || item.threat?.level === 'critical' || item.threat?.level === 'high').length;
    const plannedAngles = this.buildAngles(recent);
    const followUps = recent.slice(0, 4);

    this.setCount(plannedAngles.length);
    this.setContent(`
      <div style="display:grid;gap:12px">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${this.renderMetric(t('components.mediaStoryline.metricTopics'), String(plannedAngles.length || 0), t('components.mediaStoryline.metricTopicsHint'))}
          ${this.renderMetric(t('components.mediaStoryline.metricAlerts'), String(criticalCount), t('components.mediaStoryline.metricAlertsHint'))}
          ${this.renderMetric(t('components.mediaStoryline.metricSources'), String(trackedSources), t('components.mediaStoryline.metricSourcesHint'))}
        </div>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
            <strong style="font-size:12px">${escapeHtml(t('components.mediaStoryline.sectionAngles'))}</strong>
            <span style="font-size:10px;color:var(--text-dim)">${escapeHtml(this.formatToday())}</span>
          </div>
          <div style="display:grid;gap:8px">
            ${plannedAngles.length > 0
              ? plannedAngles.map((angle, index) => `
                <div style="display:flex;gap:10px;align-items:flex-start">
                  <span style="min-width:18px;height:18px;border-radius:999px;background:rgba(99,102,241,0.18);color:#c7d2fe;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${index + 1}</span>
                  <div style="min-width:0">
                    <button type="button" data-storyline-angle-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer">
                      <div style="font-size:12px;font-weight:600">${escapeHtml(angle.name)}</div>
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
                <div style="padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
                  <div style="font-size:12px;line-height:1.45">${escapeHtml(item.title)}</div>
                  <div style="margin-top:4px;font-size:10px;color:var(--text-dim)">${escapeHtml(item.source)} · ${escapeHtml(this.relativeTime(item.pubDate))}</div>
                </div>
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
        relatedItems: items.filter((item) => bucket.patterns.some((pattern) => pattern.test(item.title))).slice(0, 6),
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
    const recent = this.items.filter((item) => hoursAgo(item.pubDate) <= 18);
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

  private renderMetric(label: string, value: string, hint: string): string {
    return `
      <div style="padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
        <div style="font-size:10px;color:var(--text-dim)">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:10px;color:var(--text-dim)">${escapeHtml(hint)}</div>
      </div>
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
