import path from "node:path";

export function resolveWorkspacePath(inputPath: string): string {
  if (!inputPath || path.isAbsolute(inputPath)) {
    throw new Error("Path must be a non-empty relative path.");
  }

  const workspace = process.cwd();
  const resolvedPath = path.resolve(workspace, inputPath);
  const relativePath = path.relative(workspace, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Path must stay inside the project workspace.");
  }

  return resolvedPath;
}
