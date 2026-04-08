import { Panel } from './Panel';
import { t } from '@/services/i18n';
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

function matchCount(items: NewsItem[], patterns: RegExp[]): number {
  return items.filter((item) => patterns.some((pattern) => pattern.test(item.title))).length;
}

export class MediaBusinessRadarPanel extends Panel {
  private items: NewsItem[] = [];

  constructor() {
    super({
      id: 'media-business-radar',
      title: t('panels.mediaBusinessRadar'),
      showCount: true,
      infoTooltip: t('components.mediaBusinessRadar.infoTooltip'),
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
    const ranked = RADAR_BUCKETS
      .map((bucket) => ({
        name: t(bucket.labelKey),
        hint: t(bucket.hintKey),
        count: matchCount(this.items, bucket.patterns),
      }))
      .sort((a, b) => b.count - a.count);

    const topSignals = ranked.slice(0, 3);
    const opportunityCount = ranked.filter((item) => item.count >= 3).length;
    const watchCount = ranked.filter((item) => item.count > 0).length;
    const riskCount = this.items.filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical').length;

    this.setCount(watchCount);
    this.setContent(`
      <div style="display:grid;gap:12px">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${this.metricCard(t('components.mediaBusinessRadar.metricSignals'), String(watchCount), t('components.mediaBusinessRadar.metricSignalsHint'))}
          ${this.metricCard(t('components.mediaBusinessRadar.metricOpportunities'), String(opportunityCount), t('components.mediaBusinessRadar.metricOpportunitiesHint'))}
          ${this.metricCard(t('components.mediaBusinessRadar.metricRisks'), String(riskCount), t('components.mediaBusinessRadar.metricRisksHint'))}
        </div>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaBusinessRadar.sectionRadar'))}</strong>
          <div style="display:grid;gap:8px">
            ${ranked.map((item) => `
              <div style="display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center">
                <span style="font-size:11px">${escapeHtml(item.name)}</span>
                <div style="height:6px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden">
                  <div style="width:${Math.min(100, item.count * 18)}%;height:100%;background:linear-gradient(90deg,#38bdf8,#f59e0b)"></div>
                </div>
                <span style="font-size:11px;color:var(--text-dim)">${escapeHtml(String(item.count))}</span>
              </div>
            `).join('')}
          </div>
        </section>

        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <strong style="display:block;font-size:12px;margin-bottom:8px">${escapeHtml(t('components.mediaBusinessRadar.sectionActions'))}</strong>
          <div style="display:grid;gap:8px">
            ${topSignals.length > 0
              ? topSignals.map((item) => `
                <div style="padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
                  <div style="font-size:12px;font-weight:600">${escapeHtml(item.name)}</div>
                  <div style="margin-top:3px;font-size:11px;color:var(--text-dim);line-height:1.5">${escapeHtml(item.hint)}</div>
                </div>
              `).join('')
              : `<div style="font-size:12px;color:var(--text-dim)">${escapeHtml(t('components.mediaBusinessRadar.empty'))}</div>`}
          </div>
        </section>
      </div>
    `);
  }

  private metricCard(label: string, value: string, hint: string): string {
    return `
      <div style="padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
        <div style="font-size:10px;color:var(--text-dim)">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:10px;color:var(--text-dim)">${escapeHtml(hint)}</div>
      </div>
    `;
  }
}
