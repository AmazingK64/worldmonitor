import { Panel } from './Panel';
import { MediaDetailModal } from './MediaDetailModal';
import { t } from '@/services/i18n';
import { generateMediaTopicAnalysis } from '@/services/media-analysis';
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
  private modal = new MediaDetailModal();

  constructor() {
    super({
      id: 'media-business-radar',
      title: t('panels.mediaBusinessRadar'),
      showCount: true,
      infoTooltip: t('components.mediaBusinessRadar.infoTooltip'),
    });
    this.content.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-radar-role][data-radar-index]');
      if (!target) return;
      event.preventDefault();
      const index = Number(target.dataset.radarIndex || -1);
      const role = target.dataset.radarRole as 'signal' | 'opportunity' | 'risk' | undefined;
      if (index >= 0 && role) this.openRadarDetail(role, index);
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
        relatedItems: this.items.filter((item) => bucket.patterns.some((pattern) => pattern.test(item.title))).slice(0, 6),
      }))
      .map((bucket) => ({ ...bucket, count: bucket.relatedItems.length }))
      .sort((a, b) => b.count - a.count);

    const topSignals = ranked.slice(0, 3);
    const riskItems = this.items
      .filter((item) => item.isAlert || item.threat?.level === 'high' || item.threat?.level === 'critical')
      .slice(0, 5);
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
            ${ranked.map((item, index) => `
              <div style="display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center">
                <button type="button" data-radar-role="signal" data-radar-index="${index}" style="padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;font-size:11px">${escapeHtml(item.name)}</button>
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
              ? topSignals.map((item, index) => `
                <div style="padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
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
                <div style="padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
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

  private metricCard(label: string, value: string, hint: string): string {
    return `
      <div style="padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
        <div style="font-size:10px;color:var(--text-dim)">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:10px;color:var(--text-dim)">${escapeHtml(hint)}</div>
      </div>
    `;
  }

  private openRadarDetail(role: 'signal' | 'opportunity' | 'risk', index: number): void {
    const ranked = RADAR_BUCKETS
      .map((bucket) => ({
        name: t(bucket.labelKey),
        hint: t(bucket.hintKey),
        relatedItems: this.items.filter((item) => bucket.patterns.some((pattern) => pattern.test(item.title))).slice(0, 6),
      }))
      .map((bucket) => ({ ...bucket, count: bucket.relatedItems.length }))
      .sort((a, b) => b.count - a.count);
    const riskItems = this.items
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
}
