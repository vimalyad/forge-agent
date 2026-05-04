import fs from 'node:fs/promises';
import path from 'node:path';

export class OutputValidator {
  async validate(): Promise<string | null> {
    const filePath = path.resolve(process.cwd(), 'output/index.html');

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const normalizedContent = content.toLowerCase();
      const placeholders = [
        '<updated_html_content>',
        '<scrape_result>',
        '<html_content>',
        'todo',
        'content goes here',
        'placeholder',
      ];

      if (placeholders.some((placeholder) => normalizedContent.includes(placeholder))) {
        return 'output/index.html still contains placeholder content.';
      }

      const requiredParts = ['<html', '<header', '<section', '<footer', '<style', '<script'];
      const missingParts = requiredParts.filter((part) => !normalizedContent.includes(part));

      if (missingParts.length > 0) {
        return `output/index.html is missing ${missingParts.join(', ')}.`;
      }

      if (content.length < 1500) {
        return 'output/index.html is too small to satisfy the clone requirements.';
      }

      if (content.length < 6000) {
        return 'output/index.html is too thin for a high-quality clone. Add richer sections, content, and responsive styling.';
      }

      if (/[\uFFFD]/.test(content)) {
        return 'output/index.html contains broken encoded characters.';
      }

      if (/[\u{1F300}-\u{1FAFF}]/u.test(content)) {
        return 'output/index.html contains emoji. Use professional text labels or CSS instead.';
      }

      return null;
    } catch (error) {
      return `output/index.html is not readable: ${(error as Error).message}`;
    }
  }
}
