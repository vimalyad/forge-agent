import fs from "node:fs/promises";
import path from "node:path";
import { OUTPUT_FILE_PATH } from "../config/modelRuntime.js";

export class OutputValidator {
  async validate(): Promise<string | null> {
    const filePath = path.resolve(process.cwd(), OUTPUT_FILE_PATH);

    try {
      const content = await fs.readFile(filePath, "utf8");
      const normalizedContent = content.toLowerCase();
      const placeholders = [
        "<updated_html_content>",
        "<scrape_result>",
        "<html_content>",
        "content goes here",
        "placeholder",
      ];

      if (
        placeholders.some((placeholder) =>
          normalizedContent.includes(placeholder),
        )
      ) {
        return `${OUTPUT_FILE_PATH} still contains placeholder content.`;
      }

      const requiredParts = ["<html", "<style", "<script"];
      const missingParts = requiredParts.filter(
        (part) => !normalizedContent.includes(part),
      );

      const hasHeader =
        /<header[\s>]|id=["']header["']|class=["'][^"']*header/.test(
          normalizedContent,
        );
      if (!hasHeader) missingParts.push("header");

      const hasFooter =
        /<footer[\s>]|id=["']footer["']|class=["'][^"']*footer/.test(
          normalizedContent,
        );
      if (!hasFooter) missingParts.push("footer");

      const hasSection = /<(section|main|article)[\s>]/.test(normalizedContent);
      if (!hasSection) missingParts.push("section/main/article");

      if (missingParts.length > 0) {
        return `${OUTPUT_FILE_PATH} is missing ${missingParts.join(", ")}.`;
      }

      if (content.length < 1500) {
        return `${OUTPUT_FILE_PATH} is too small to satisfy the clone requirements.`;
      }

      if (content.length < 6000) {
        return `${OUTPUT_FILE_PATH} is too thin for a high-quality clone. Add richer sections, content, and responsive styling.`;
      }

      if (/[\uFFFD]/.test(content)) {
        return `${OUTPUT_FILE_PATH} contains broken encoded characters.`;
      }

      if (/[\u{1F300}-\u{1FAFF}]/u.test(content)) {
        return `${OUTPUT_FILE_PATH} contains emoji. Use professional text labels or CSS instead.`;
      }

      return null;
    } catch (error) {
      return `${OUTPUT_FILE_PATH} is not readable: ${(error as Error).message}`;
    }
  }
}
