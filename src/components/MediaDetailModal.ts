import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

export interface MediaDetailModalSection {
  title: string;
  content: string;
}

export interface MediaDetailModalLink {
  label: string;
  href?: string;
  meta?: string;
}

export interface MediaDetailModalOptions {
  title: string;
  subtitle?: string;
  tags?: string[];
  sections?: MediaDetailModalSection[];
  links?: MediaDetailModalLink[];
  analysisTitle?: string;
  analysisLoadingText?: string;
  analysisPromise?: Promise<string>;
}

export class MediaDetailModal {
  private overlay: HTMLElement;
  private escHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.hide();
  };
  private typewriterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.hide();
    });
    document.body.appendChild(this.overlay);
  }

  public show(options: MediaDetailModalOptions): void {
    this.clearTypewriter();

    this.overlay.innerHTML = `
      <div class="modal" style="max-width:680px;border-radius:16px;padding:0;overflow:hidden">
        <div class="modal-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--border);align-items:flex-start">
          <div style="display:grid;gap:8px;min-width:0">
            <div class="modal-title" style="font-size:16px;letter-spacing:0;text-transform:none;line-height:1.4">${escapeHtml(options.title)}</div>
            ${options.subtitle ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.5">${escapeHtml(options.subtitle)}</div>` : ''}
            ${options.tags?.length ? `
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${options.tags.map((tag) => `<span style="padding:4px 8px;border-radius:999px;border:1px solid var(--border);font-size:10px;color:var(--text-dim)">${escapeHtml(tag)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div style="padding:18px 20px;display:grid;gap:16px;max-height:70vh;overflow:auto">
          ${(options.sections || []).map((section) => `
            <section style="display:grid;gap:6px">
              <div style="font-size:12px;font-weight:700">${escapeHtml(section.title)}</div>
              <div style="font-size:12px;line-height:1.7;color:var(--text-dim);white-space:pre-wrap">${escapeHtml(section.content)}</div>
            </section>
          `).join('')}
          ${options.links?.length ? `
            <section style="display:grid;gap:8px">
              <div style="font-size:12px;font-weight:700">相关内容</div>
              <div style="display:grid;gap:8px">
                ${options.links.map((link) => {
                  const href = link.href ? sanitizeUrl(link.href) : '';
                  const label = escapeHtml(link.label);
                  const meta = link.meta ? `<div style="font-size:10px;color:var(--text-dim);margin-top:3px">${escapeHtml(link.meta)}</div>` : '';
                  if (href) {
                    return `<a href="${href}" target="_blank" rel="noopener" style="display:block;padding:10px 12px;border:1px solid var(--border);border-radius:12px;text-decoration:none;color:var(--text);background:rgba(255,255,255,0.03)">${label}${meta}</a>`;
                  }
                  return `<div style="padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03)">${label}${meta}</div>`;
                }).join('')}
              </div>
            </section>
          ` : ''}
          <section style="display:grid;gap:8px">
            <div style="font-size:12px;font-weight:700">${escapeHtml(options.analysisTitle || 'AI 分析')}</div>
            <div data-media-analysis-body style="padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.03);font-size:12px;line-height:1.7;color:var(--text-dim);white-space:pre-wrap"><span class="ai-typewriter-text">${escapeHtml(options.analysisLoadingText || 'AI 正在分析中...')}</span><span class="ai-typewriter-cursor"></span></div>
          </section>
        </div>
      </div>
    `;

    this.overlay.querySelector('.modal-close')?.addEventListener('click', () => this.hide(), { once: true });
    this.overlay.classList.add('active');
    document.addEventListener('keydown', this.escHandler);

    const analysisBody = this.overlay.querySelector<HTMLElement>('[data-media-analysis-body]');
    const textEl = analysisBody?.querySelector('.ai-typewriter-text');
    const cursorEl = analysisBody?.querySelector('.ai-typewriter-cursor');
    if (analysisBody && textEl && cursorEl && options.analysisPromise) {
      options.analysisPromise
        .then((text) => {
          if (!this.overlay.classList.contains('active')) return;
          textEl.textContent = '';
          this.animateTypewriter(textEl, cursorEl, text);
        })
        .catch(() => {
          if (!this.overlay.classList.contains('active')) return;
          textEl.textContent = '当前无法生成 AI 分析，已显示基础内容供继续判断。';
          cursorEl.classList.add('hidden');
        });
    }
  }

  private animateTypewriter(textEl: Element, cursorEl: Element, text: string): void {
    this.clearTypewriter();
    let index = 0;
    const speed = 18;
    const tick = () => {
      if (index < text.length) {
        textEl.textContent += text[index];
        index++;
        this.typewriterTimer = setTimeout(tick, speed);
      } else {
        cursorEl.classList.add('hidden');
      }
    };
    tick();
  }

  private clearTypewriter(): void {
    if (this.typewriterTimer !== null) {
      clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }

  public hide(): void {
    this.clearTypewriter();
    this.overlay.classList.remove('active');
    this.overlay.innerHTML = '';
    document.removeEventListener('keydown', this.escHandler);
  }
}
