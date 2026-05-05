import zlib from "node:zlib";
import type { ITool, ToolResult, MediaAssets } from "../core/ITool.js";
import { Type, type FunctionDeclaration } from "../core/ToolSchema.js";

type RenderResult = {
  url: string;
  html: string;
  source: "playwright" | "fetch";
  semanticText?: string;
  fallbackReason?: string;
  /** PNG screenshot as base64, only present when Playwright is used. */
  screenshotBase64?: string;
  mediaAssets?: MediaAssets;
};

function formatMediaAssets(assets: MediaAssets | undefined): string {
  if (!assets) return "";
  const lines: string[] = ["\nmedia_assets:"];
  if (assets.logos.length)
    lines.push(
      "logos:\n" +
        assets.logos.map((l) => `  - ${l.src} (alt: ${l.alt})`).join("\n"),
    );
  if (assets.heroImages.length)
    lines.push(
      "hero_images:\n" +
        assets.heroImages
          .map((i) => `  - ${i.src} (${i.width}px, alt: ${i.alt})`)
          .join("\n"),
    );
  if (assets.backgroundImages.length)
    lines.push(
      "background_images:\n" +
        assets.backgroundImages.map((u) => `  - ${u}`).join("\n"),
    );
  if (assets.fontLinks.length)
    lines.push(
      "font_links:\n" + assets.fontLinks.map((u) => `  - ${u}`).join("\n"),
    );
  if (assets.icons.length)
    lines.push(
      "favicon:\n" +
        assets.icons
          .slice(0, 2)
          .map((u) => `  - ${u}`)
          .join("\n"),
    );
  return lines.join("\n");
}

export class ScrapeWebsiteTool implements ITool {
  readonly name = "scrape_website";

  readonly schema: FunctionDeclaration = {
    name: this.name,
    description:
      "Render and clean a website into a compact semantic blueprint for webpage recreation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "HTTP or HTTPS URL to scrape.",
        },
      },
      required: ["url"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const { text } = await this.executeRich(args);
    return text;
  }

  async executeRich(args: Record<string, unknown>): Promise<ToolResult> {
    const url = String(args.url ?? "");
    const rendered = await this.render(url);

    let text = [
      `url: ${rendered.url}`,
      `source: ${rendered.source}`,
      rendered.fallbackReason
        ? `fallback_reason: ${rendered.fallbackReason}`
        : "",
      rendered.semanticText
        ? `rendered_semantic_tree:\n${rendered.semanticText}`
        : "",
      this.cleanHtml(rendered.html),
    ]
      .filter(Boolean)
      .join("\n\n");

    text += formatMediaAssets(rendered.mediaAssets);
    text = text.slice(0, 22000);

    return {
      text,
      screenshotBase64: rendered.screenshotBase64,
      mediaAssets: rendered.mediaAssets,
    };
  }

  private async render(url: string): Promise<RenderResult> {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    const playwrightResult = await this.tryPlaywright(parsedUrl.toString());

    if (playwrightResult.result) {
      return playwrightResult.result;
    }

    const response = await fetch(parsedUrl, {
      headers: {
        "User-Agent": "forge-agent/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    return {
      url: parsedUrl.toString(),
      html: await response.text(),
      source: "fetch",
      fallbackReason: playwrightResult.reason,
    };
  }

  private async tryPlaywright(
    url: string,
  ): Promise<{ result: RenderResult | null; reason?: string }> {
    try {
      const moduleName = "playwright";
      const playwright = await import(moduleName);
      const browser = await playwright.chromium.launch({ headless: true });

      try {
        const page = await browser.newPage();
        // Keep images enabled so the screenshot reflects the real visual layout
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(3000);
        const semanticText = await page.evaluate(() => {
          const selector = [
            "header",
            "nav",
            "main",
            "section",
            "article",
            "footer",
            "h1",
            "h2",
            "h3",
            "p",
            "a",
            "button",
          ].join(",");

          return Array.from(document.querySelectorAll(selector))
            .map((element) => {
              const tag = element.tagName.toLowerCase();
              const role = element.getAttribute("role");
              const label = element.getAttribute("aria-label");
              const href =
                element instanceof HTMLAnchorElement ? element.href : "";
              const text = (element.textContent ?? "")
                .replace(/\s+/g, " ")
                .trim();

              let classesStr = "";
              if (
                typeof element.className === "string" &&
                element.className.trim()
              ) {
                const parts = element.className.trim().split(/\s+/).slice(0, 3);
                if (parts.length > 0) classesStr = `classes=${parts.join(" ")}`;
              }

              return [
                tag,
                classesStr,
                role ? `role=${role}` : "",
                label ? `label=${label}` : "",
                href ? `href=${href}` : "",
                text,
              ]
                .filter(Boolean)
                .join(" | ");
            })
            .filter((line) => line.length > 4)
            .slice(0, 160)
            .join("\n");
        });

        const heightData = await page.evaluate(() => ({
          full: document.body.scrollHeight,
          viewport: window.innerHeight,
        }));

        let screenshotBuffer: Buffer;

        try {
          const buffers: Buffer[] = [];
          const maxShots = 2;
          let currentScroll = 0;
          for (let i = 0; i < maxShots; i++) {
            await page.evaluate(
              (y: number) => window.scrollTo(0, y),
              currentScroll,
            );
            await page.waitForTimeout(500);
            const buf = await page.screenshot({ fullPage: false, type: "png" });
            buffers.push(buf);
            currentScroll += heightData.viewport;
            if (currentScroll >= heightData.full) break;
          }
          screenshotBuffer = this.stitchPngs(buffers);
        } catch (error) {
          screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: "png",
          });
        }

        const screenshotBase64 = screenshotBuffer.toString("base64");

        const mediaAssets = (await page.evaluate((): MediaAssets => {
          const logos: { src: string; alt: string }[] = [];
          const heroImages: { src: string; alt: string; width: number }[] = [];
          const backgroundImages: string[] = [];
          const fontLinks: string[] = [];
          const icons: string[] = [];
          const videos: string[] = [];

          const logoSelectors = [
            "header img",
            "nav img",
            'img[alt*="logo" i]',
            'img[class*="logo" i]',
            'img[src*="logo" i]',
          ];
          for (const sel of logoSelectors) {
            document.querySelectorAll(sel).forEach((el) => {
              const img = el as HTMLImageElement;
              if (img.src?.startsWith("http") && img.width > 20) {
                logos.push({ src: img.src, alt: img.alt });
              }
            });
            if (logos.length > 0) break;
          }

          document.querySelectorAll("img[src]").forEach((el) => {
            const img = el as HTMLImageElement;
            const rect = img.getBoundingClientRect();
            if (
              img.src?.startsWith("http") &&
              rect.top < 900 &&
              rect.width > 100 &&
              !logos.some((l) => l.src === img.src)
            ) {
              heroImages.push({
                src: img.src,
                alt: img.alt,
                width: Math.round(rect.width),
              });
            }
          });

          document
            .querySelectorAll(
              'header, main, section, div, [class*="hero" i], [class*="banner" i]',
            )
            .forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.top > 900) return;
              const bg = getComputedStyle(el).backgroundImage;
              const match = bg.match(/url\(["']?(https?[^"')]+)/);
              if (match && !backgroundImages.includes(match[1])) {
                backgroundImages.push(match[1]);
              }
            });

          document
            .querySelectorAll('link[rel="stylesheet"], link[rel="preload"]')
            .forEach((el) => {
              const href = (el as HTMLLinkElement).href;
              if (
                href &&
                (href.includes("fonts.google") ||
                  href.includes("typekit") ||
                  href.includes("fonts.gstatic"))
              ) {
                fontLinks.push(href);
              }
            });

          document.querySelectorAll('link[rel*="icon"]').forEach((el) => {
            const href = (el as HTMLLinkElement).href;
            if (href?.startsWith("http")) icons.push(href);
          });

          document
            .querySelectorAll("video[src], video source[src]")
            .forEach((el) => {
              const src = (el as HTMLSourceElement).src;
              if (src?.startsWith("http")) videos.push(src);
            });

          return {
            logos,
            heroImages,
            backgroundImages,
            fontLinks,
            icons,
            videos,
          };
        })) as MediaAssets;

        return {
          result: {
            url,
            html: await page.content(),
            source: "playwright",
            semanticText,
            screenshotBase64,
            mediaAssets,
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
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");

    const title = this.firstMatch(
      withoutNoise,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    );
    const description = this.metaContent(withoutNoise, "description");
    const headings = this.extractTags(withoutNoise, "h[1-3]", 24);
    const buttons = this.extractTags(withoutNoise, "button", 18);
    const links = this.extractLinks(withoutNoise, 28);
    const sections = this.extractTags(
      withoutNoise,
      "section|main|header|footer|article|nav",
      18,
    );

    return [
      "cleaned semantic blueprint:",
      `title: ${title || "(none)"}`,
      `description: ${description || "(none)"}`,
      "",
      "headings:",
      headings.join("\n") || "(none)",
      "",
      "buttons:",
      buttons.join("\n") || "(none)",
      "",
      "links:",
      links.join("\n") || "(none)",
      "",
      "landmark text:",
      sections.join("\n\n") || this.textOnly(withoutNoise).slice(0, 5000),
    ].join("\n");
  }

  private firstMatch(html: string, pattern: RegExp): string {
    return this.decode(this.stripTags(html.match(pattern)?.[1] ?? ""));
  }

  private metaContent(html: string, name: string): string {
    const pattern = new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    return this.decode(html.match(pattern)?.[1] ?? "");
  }

  private extractTags(
    html: string,
    tagPattern: string,
    limit: number,
  ): string[] {
    const pattern = new RegExp(
      `<(${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
      "gi",
    );
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
    return this.decode(this.stripTags(html)).replace(/\s+/g, " ").trim();
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, " ");
  }

  private decode(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private stitchPngs(buffers: Buffer[]): Buffer {
    if (buffers.length === 1) return buffers[0];

    let totalHeight = 0;
    let width = 0;
    const uncompressedScanlines: Buffer[] = [];

    for (const buf of buffers) {
      if (
        buf.readUInt32BE(0) !== 0x89504e47 ||
        buf.readUInt32BE(4) !== 0x0d0a1a0a
      ) {
        throw new Error("Not a PNG");
      }
      let offset = 8;
      let h = 0;
      const idats: Buffer[] = [];
      while (offset < buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.toString("ascii", offset + 4, offset + 8);
        if (type === "IHDR") {
          if (!width) width = buf.readUInt32BE(offset + 8);
          h = buf.readUInt32BE(offset + 12);
        } else if (type === "IDAT") {
          idats.push(buf.subarray(offset + 8, offset + 8 + length));
        } else if (type === "IEND") {
          break;
        }
        offset += length + 12;
      }
      totalHeight += h;
      uncompressedScanlines.push(zlib.inflateSync(Buffer.concat(idats)));
    }

    const uncompressed = Buffer.concat(uncompressedScanlines);
    const newCompressed = zlib.deflateSync(uncompressed);

    const template = buffers[0];
    const newPng: Buffer[] = [];
    newPng.push(template.subarray(0, 8));

    let offset = 8;
    while (offset < template.length) {
      const length = template.readUInt32BE(offset);
      const type = template.toString("ascii", offset + 4, offset + 8);

      if (type === "IHDR") {
        const ihdr = Buffer.alloc(length + 12);
        template.copy(ihdr, 0, offset, offset + length + 12);
        ihdr.writeUInt32BE(totalHeight, 12);
        const crc = this.crc32(ihdr.subarray(4, 4 + 4 + length));
        ihdr.writeUInt32BE(crc, 8 + length);
        newPng.push(ihdr);
      } else if (type === "IDAT") {
        // skip original IDATs
      } else if (type === "IEND") {
        const idat = Buffer.alloc(newCompressed.length + 12);
        idat.writeUInt32BE(newCompressed.length, 0);
        idat.write("IDAT", 4);
        newCompressed.copy(idat, 8);
        const crc = this.crc32(idat.subarray(4, 4 + newCompressed.length + 4));
        idat.writeUInt32BE(crc, 8 + newCompressed.length);
        newPng.push(idat);
        newPng.push(template.subarray(offset, offset + length + 12));
        break;
      } else {
        newPng.push(template.subarray(offset, offset + length + 12));
      }

      offset += length + 12;
    }

    return Buffer.concat(newPng);
  }

  private crc32(buf: Buffer): number {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      crc = crc ^ byte;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ -1) >>> 0;
  }
}
