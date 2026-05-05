import { exec } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

export function openInBrowser(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  const url = pathToFileURL(absolutePath).href;

  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      console.warn(
        `[preview] Could not open browser automatically: ${error.message}`,
      );
      console.log(`[preview] Open manually: ${url}`);
    } else {
      console.log(`[preview] Opened in browser: ${url}`);
    }
  });
}
