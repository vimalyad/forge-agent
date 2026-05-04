import { Type, type FunctionDeclaration } from '@google/genai';
import type { ITool } from './ITool.js';

type RenderResult = {
  url: string;
  html: string;
  source: 'playwright' | 'fetch';
  semanticText?: string;
  fallbackReason?: string;
};

export class ScrapeWebsiteTool implements ITool {
  readonly name = 'scrape_website';

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description: 'Render and clean a website into a compact semantic blueprint for webpage recreation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'HTTP or HTTPS URL to scrape.',
        },
      },
      required: ['url'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url ?? '');
    const rendered = await this.render(url);

    return [
      `url: ${rendered.url}`,
      `source: ${rendered.source}`,
      rendered.fallbackReason ? `fallback_reason: ${rendered.fallbackReason}` : '',
      rendered.semanticText ? `rendered_semantic_tree:\n${rendered.semanticText}` : '',
      this.cleanHtml(rendered.html),
    ].filter(Boolean).join('\n\n').slice(0, 22000);
  }

  private async render(url: string): Promise<RenderResult> {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported.');
    }

    const playwrightResult = await this.tryPlaywright(parsedUrl.toString());

    if (playwrightResult.result) {
      return playwrightResult.result;
    }

    const response = await fetch(parsedUrl, {
      headers: {
        'User-Agent': 'forge-agent/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    return {
      url: parsedUrl.toString(),
      html: await response.text(),
      source: 'fetch',
      fallbackReason: playwrightResult.reason,
    };
  }

  private async tryPlaywright(url: string): Promise<{ result: RenderResult | null; reason?: string }> {
    try {
      const moduleName = 'playwright';
      const playwright = await import(moduleName);
      const browser = await playwright.chromium.launch({ headless: true });

      try {
        const page = await browser.newPage();
        await page.route('**/*', async (route: {
          request(): { resourceType(): string };
          abort(): Promise<void>;
          continue(): Promise<void>;
        }) => {
          const resourceType = route.request().resourceType();

          if (['image', 'media', 'font'].includes(resourceType)) {
            await route.abort();
            return;
          }

          await route.continue();
        });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);
        const semanticText = await page.evaluate(() => {
          const selector = [
            'header',
            'nav',
            'main',
            'section',
            'article',
            'footer',
            'h1',
            'h2',
            'h3',
            'p',
            'a',
            'button',
          ].join(',');

          return Array.from(document.querySelectorAll(selector))
            .map((element) => {
              const tag = element.tagName.toLowerCase();
              const role = element.getAttribute('role');
              const label = element.getAttribute('aria-label');
              const href = element instanceof HTMLAnchorElement ? element.href : '';
              const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();

              return [tag, role ? `role=${role}` : '', label ? `label=${label}` : '', href ? `href=${href}` : '', text]
                .filter(Boolean)
                .join(' | ');
            })
            .filter((line) => line.length > 4)
            .slice(0, 160)
            .join('\n');
        });

        return {
          result: {
            url,
            html: await page.content(),
            source: 'playwright',
            semanticText,
          },
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      return {
        result: null,
        reason: (error as Error).message,
      };
    }
  }

  private cleanHtml(html: string): string {
    const withoutNoise = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    const title = this.firstMatch(withoutNoise, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = this.metaContent(withoutNoise, 'description');
    const headings = this.extractTags(withoutNoise, 'h[1-3]', 24);
    const buttons = this.extractTags(withoutNoise, 'button', 18);
    const links = this.extractLinks(withoutNoise, 28);
    const sections = this.extractTags(withoutNoise, 'section|main|header|footer|article|nav', 18);

    return [
      'cleaned semantic blueprint:',
      `title: ${title || '(none)'}`,
      `description: ${description || '(none)'}`,
      '',
      'headings:',
      headings.join('\n') || '(none)',
      '',
      'buttons:',
      buttons.join('\n') || '(none)',
      '',
      'links:',
      links.join('\n') || '(none)',
      '',
      'landmark text:',
      sections.join('\n\n') || this.textOnly(withoutNoise).slice(0, 5000),
    ].join('\n');
  }

  private firstMatch(html: string, pattern: RegExp): string {
    return this.decode(this.stripTags(html.match(pattern)?.[1] ?? ''));
  }

  private metaContent(html: string, name: string): string {
    const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    return this.decode(html.match(pattern)?.[1] ?? '');
  }

  private extractTags(html: string, tagPattern: string, limit: number): string[] {
    const pattern = new RegExp(`<(${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
    const results: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) && results.length < limit) {
      const text = this.textOnly(match[2]);

      if (text.length > 2) {
        results.push(`- ${match[1].toLowerCase()}: ${text.slice(0, 500)}`);
      }
    }

    return results;
  }

  private extractLinks(html: string, limit: number): string[] {
    const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const results: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) && results.length < limit) {
      const text = this.textOnly(match[2]);

      if (text.length > 1) {
        results.push(`- ${text.slice(0, 100)} -> ${match[1]}`);
      }
    }

    return results;
  }

  private textOnly(html: string): string {
    return this.decode(this.stripTags(html)).replace(/\s+/g, ' ').trim();
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, ' ');
  }

  private decode(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
