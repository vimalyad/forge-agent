export const API_ENDPOINTS = {
  anthropicMessages: "https://api.anthropic.com/v1/messages",
  openRouterChatCompletions: "https://openrouter.ai/api/v1/chat/completions",
} as const;

export const APP_HTTP_HEADERS = {
  referer: "https://github.com/forge-agent",
  title: "forge-agent",
} as const;

export const DRAFT_HTML_MODELS = [
  "openrouter/free",
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-r1:free",
] as const;
export const HTML_MAX_TOKENS = 8192;
export const FINAL_HTML_MAX_TOKENS = 16000;
export const URL_RESOLVE_MAX_TOKENS = 80;
export const BLUEPRINT_CHAR_LIMIT = 3500;
export const PREVIOUS_HTML_CHAR_LIMIT = 4000;
export const SCRAPE_MAX_SCREENSHOTS = 2;

export const OUTPUT_FILE_PATH = "output/index.html";
export const PRE_JUDGED_TOOLS = new Set(["write_file"]);
