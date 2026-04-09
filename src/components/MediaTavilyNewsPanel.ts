import { Panel } from './Panel';
import { fetchMediaTavilyNews, summarizeMediaNewsItem, type MediaTavilyNewsItem } from '@/services/media-tavily-news';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';

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
      this.setCount(this.items.length);
      this.renderPanel();
    } catch (error) {
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
    const summaryEl = this.content.querySelector<HTMLElement>(`[data-ai-news-summary="${index}"]`);
    if (!summaryEl) return;

    if (this.expanded.has(cacheKey)) {
      summaryEl.textContent = this.expanded.get(cacheKey) || '';
      summaryEl.style.display = summaryEl.style.display === 'none' ? '' : 'none';
      return;
    }

    this.loadingIndexes.add(index);
    button.disabled = true;
    button.textContent = '…';
    summaryEl.style.display = '';
    summaryEl.textContent = 'AI 解读生成中...';

    try {
      const result = await summarizeMediaNewsItem(item);
      const summary = result || '当前无法生成 AI 解读。';
      this.expanded.set(cacheKey, summary);
      summaryEl.textContent = summary;
    } catch {
      summaryEl.textContent = '当前无法生成 AI 解读。';
    } finally {
      this.loadingIndexes.delete(index);
      button.disabled = false;
      button.textContent = '✨';
    }
  }

  private renderItem(item: MediaTavilyNewsItem, index: number): string {
    const safeUrl = sanitizeUrl(item.url);
    return `
      <article style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <a href="${safeUrl}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;line-height:1.45;text-decoration:none;color:var(--text)">
            ${escapeHtml(item.title)}
          </a>
          <button type="button" data-ai-news-index="${index}" class="panel-summarize-btn" title="AI 解读">✨</button>
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--text-dim)">${escapeHtml(item.source)} · ${escapeHtml(relativeTime(item.publishedAt))}</div>
        ${item.summary ? `<div style="margin-top:8px;font-size:11px;color:var(--text-dim);line-height:1.5">${escapeHtml(item.summary.slice(0, 180))}</div>` : ''}
        <div data-ai-news-summary="${index}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;line-height:1.6;color:var(--text)"></div>
      </article>
    `;
  }
}
