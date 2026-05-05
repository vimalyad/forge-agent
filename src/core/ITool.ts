import type { FunctionDeclaration } from "./ToolSchema.js";

export type MediaAssets = {
  logos: { src: string; alt: string }[];
  heroImages: { src: string; alt: string; width: number }[];
  backgroundImages: string[];
  fontLinks: string[];
  icons: string[];
  videos: string[];
};

/** Rich result returned by tools that support vision output (e.g. scrape_website). */
export type ToolResult = {
  /** Plain-text result forwarded as the function response. */
  text: string;
  /** PNG screenshot encoded as base64, if captured. */
  screenshotBase64?: string;
  mediaAssets?: MediaAssets;
};

export interface ITool {
  readonly name: string;
  readonly schema: FunctionDeclaration;
  execute(args: Record<string, unknown>): Promise<string>;
  /** Override to return richer output including optional screenshot. */
  executeRich?(args: Record<string, unknown>): Promise<ToolResult>;
}
