import fs from 'fs';
import path from 'path';

/** True when filePath resolves to a location strictly inside dir (no ../ escapes). */
export function isInsideDir(filePath: string, dir: string): boolean {
  const resolvedDir = path.resolve(dir);
  const resolved = path.resolve(filePath);
  return resolved.startsWith(resolvedDir + path.sep);
}

/**
 * File name of an avatar stored as `<apiBase>/uploads/avatars/<file>`. Null for any other URL
 * (other origin, subfolders, odd characters), so only our own avatar files can be deleted.
 */
export function avatarFilenameFromUrl(avatarUrl: string | null | undefined, apiBase: string): string | null {
  if (!avatarUrl) return null;
  let url: URL;
  let base: URL;
  try {
    url = new URL(avatarUrl);
    base = new URL(apiBase);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  const match = /^\/uploads\/avatars\/([A-Za-z0-9._-]+)$/.exec(url.pathname);
  if (!match || match[1] === '.' || match[1] === '..') return null;
  return match[1] ?? null;
}

/** Best-effort delete of a file, only when it lives inside dir. Never throws. */
export async function unlinkInside(filePath: string | null | undefined, dir: string): Promise<void> {
  if (!filePath || !isInsideDir(filePath, dir)) return;
  try {
    await fs.promises.unlink(path.resolve(filePath));
  } catch {
    // missing or undeletable file: not critical
  }
}
