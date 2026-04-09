import { Panel } from './Panel';
import { fetchMediaTavilyNews, generateMediaNewsForecast, type MediaTavilyNewsItem } from '@/services/media-tavily-news';
import { escapeHtml } from '@/utils/sanitize';

export class MediaNewsForecastPanel extends Panel {
  private items: MediaTavilyNewsItem[] = [];

  constructor() {
    super({
      id: 'media-news-forecast',
      title: 'AI 媒体新闻预测',
      showCount: false,
      infoTooltip: '基于 Tavily 获取到的媒体新闻，生成未来 24-72 小时的编辑、分发、广告与舆情预测。',
    });
    this.setContent('<div style="font-size:12px;color:var(--text-dim)">预测生成中...</div>');
    void this.load();
  }

  public async load(): Promise<void> {
    try {
      this.showLoading();
      const result = await fetchMediaTavilyNews(6, 7);
      this.items = result.items;
      const forecast = await generateMediaNewsForecast(this.items);
      this.renderPanel(forecast?.summary || '当前无法生成媒体新闻预测。', forecast?.model || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load';
      this.showError(message, () => { void this.load(); });
    }
  }

  private renderPanel(summary: string, model: string): void {
    const headlineList = this.items.slice(0, 3).map((item) => `
      <li style="font-size:11px;line-height:1.5;color:var(--text-dim)">${escapeHtml(item.title)}</li>
    `).join('');

    this.setContent(`
      <div style="display:grid;gap:12px">
        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">AI 预测结论</div>
          <div style="font-size:12px;line-height:1.7">${escapeHtml(summary)}</div>
          ${model ? `<div style="margin-top:8px;font-size:10px;color:var(--text-dim)">模型: ${escapeHtml(model)}</div>` : ''}
        </section>
        <section style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">预测依据</div>
          <ul style="margin:0;padding-left:16px;display:grid;gap:6px">${headlineList || '<li style="font-size:11px;color:var(--text-dim)">暂无样本新闻。</li>'}</ul>
        </section>
      </div>
    `);
  }
}
