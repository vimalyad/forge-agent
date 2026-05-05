import {
  BLUEPRINT_CHAR_LIMIT,
  PREVIOUS_HTML_CHAR_LIMIT,
} from "../../config/modelRuntime.js";
import { SYSTEM_PROMPT } from "../../config/constants.js";
import type { LlmContentBlock } from "../../core/LlmContent.js";
import type { MediaAssets } from "../../core/ITool.js";

export type HtmlGenerationPromptInput = {
  userInput: string;
  blueprint: string;
  correction: string;
  previousHtml?: string;
  screenshotBase64?: string;
  mediaAssets?: MediaAssets;
};

export type HtmlGenerationPrompt = {
  system: string;
  content: LlmContentBlock[];
};

export class HtmlGenerationPromptBuilder {
  build(input: HtmlGenerationPromptInput): HtmlGenerationPrompt {
    const textBlocks = this.buildTextBlocks(input);
    const content: LlmContentBlock[] = [];

    if (input.screenshotBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: input.screenshotBase64,
        },
      });
    }

    content.push({
      type: "text",
      text: textBlocks.filter(Boolean).join("\n\n"),
    });

    return {
      system: this.buildSystemPrompt(!!input.screenshotBase64),
      content,
    };
  }

  private buildTextBlocks(input: HtmlGenerationPromptInput): string[] {
    const textBlocks: string[] = [];

    if (input.previousHtml) {
      textBlocks.push(
        `Previous attempt HTML (enhance this, do not start from scratch):\n<previous_attempt>\n${input.previousHtml.slice(0, PREVIOUS_HTML_CHAR_LIMIT)}\n</previous_attempt>\n\nEnhancement instructions: Match hero background from screenshot exactly. Extract brand primary color and use as CSS variable. Add hover transitions to cards and buttons. Add IntersectionObserver fade-in. Add mobile nav toggle. Ensure footer background matches screenshot. Output must exceed 8000 characters.`,
      );
    } else {
      textBlocks.push(input.userInput);
    }

    if (input.screenshotBase64) {
      textBlocks.push(
        "The screenshot shows the live visual layout. Use it as the primary reference alongside the cleaned blueprint.",
      );
    }

    textBlocks.push("Cleaned website blueprint:");
    textBlocks.push(this.compactBlueprint(input.blueprint));

    if (input.mediaAssets) {
      textBlocks.push(this.formatMediaAssets(input.mediaAssets));
    }

    if (input.correction) {
      textBlocks.push(`Previous validation error: ${input.correction}`);
    }

    return textBlocks;
  }

  private buildSystemPrompt(hasScreenshot: boolean): string {
    return [
      SYSTEM_PROMPT,
      "Return only the complete HTML document. Do not use Markdown fences.",
      "Write at least 6500 characters of real HTML/CSS/JS.",
      hasScreenshot
        ? "A screenshot of the target page is included in the user message. Use it as the primary visual reference for colours, layout, fonts, and spacing."
        : "Infer the visual style from the blueprint: match the colour palette, layout structure, and typography of the target site.",
      "Real media asset URLs have been extracted from the live page and are included in the user message. Use them directly with <img src>, CSS background-image, and <link> tags. Never use placeholder image services like picsum, placehold.it, or unsplash.",
      "Include header, hero, stats/highlights strip if present, key feature sections, and footer.",
      "Use plain text labels instead of emoji for nav and social links.",
    ].join("\n");
  }

  private formatMediaAssets(assets: MediaAssets): string {
    const lines = [
      "\n--- REAL MEDIA ASSETS FROM THE LIVE PAGE ---",
      "Use these URLs directly in your HTML. Do not invent or placeholder any images, fonts, or icons.",
      "",
    ];

    if (assets.logos.length) {
      lines.push('LOGO (use in <header> as <img src="...">):');
      assets.logos.slice(0, 2).forEach((logo) => lines.push(`  ${logo.src}`));
    }

    if (assets.heroImages.length) {
      lines.push("\nHERO / ABOVE-FOLD IMAGES:");
      assets.heroImages
        .slice(0, 4)
        .forEach((image) =>
          lines.push(
            `  ${image.src}  [${image.width}px wide, alt="${image.alt}"]`,
          ),
        );
    }

    if (assets.backgroundImages.length) {
      lines.push("\nBACKGROUND IMAGES (use in CSS background-image):");
      assets.backgroundImages
        .slice(0, 3)
        .forEach((url) => lines.push(`  ${url}`));
    }

    if (assets.fontLinks.length) {
      lines.push("\nFONT STYLESHEETS (add as <link> in <head>):");
      assets.fontLinks.forEach((url) => lines.push(`  ${url}`));
    }

    if (assets.icons.length) {
      lines.push("\nFAVICON:");
      lines.push(`  ${assets.icons[0]}`);
    }

    lines.push("--- END MEDIA ASSETS ---\n");
    return lines.join("\n");
  }

  private compactBlueprint(blueprint: string): string {
    // Keep visual and structural signals while trimming noisy page text before it reaches paid models.
    const importantLines = blueprint.split("\n").filter((line) => {
      const lower = line.toLowerCase();

      return [
        "source:",
        "url:",
        "title:",
        "description:",
        "h1:",
        "h2:",
        "h3:",
        "header",
        "nav",
        "hero",
        "footer",
        "section",
        "feature",
        "pricing",
        "cta",
        "button",
        "link",
        "class=",
        "classes=",
        "background",
        "gradient",
        "color",
        "font",
        "weight",
        "dark",
        "light",
        "primary",
        "secondary",
        "accent",
      ].some((signal) => lower.includes(signal));
    });

    const compact = importantLines.join("\n").replace(/\n{3,}/g, "\n\n");
    return (compact || blueprint).slice(0, BLUEPRINT_CHAR_LIMIT);
  }
}
