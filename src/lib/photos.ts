import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { TaskPhoto } from "./tasks";

/**
 * The one place that knows where task photos live.
 *
 * Today: local files in `.data/photos` (git-ignored, never committed).
 * When the app goes online (M11), only this file changes: save/read/delete
 * will use cloud storage instead, and every caller keeps using the photo
 * URL saved on the task. Nothing else in the app touches photo files.
 */

const PHOTOS_DIR = path.join(process.cwd(), ".data", "photos");

export const MAX_PHOTOS_PER_TASK = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const EXT_TO_CONTENT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(CONTENT_TYPE_TO_EXT).map(([type, ext]) => [ext, type]),
);

export function isSupportedPhotoType(contentType: string): boolean {
  return contentType in CONTENT_TYPE_TO_EXT;
}

export function photoUrl(name: string): string {
  return `/api/photos/${name}`;
}

/** Accept only plain generated file names — never a path (no "..", no "/"). */
function safeFileName(name: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\.[a-z0-9]+$/.test(name)) return null;
  return name;
}

export async function savePhoto(
  taskId: string,
  bytes: Buffer,
  contentType: string,
): Promise<TaskPhoto> {
  const ext = CONTENT_TYPE_TO_EXT[contentType];
  if (!ext) throw new Error(`Unsupported photo type: ${contentType}`);
  const name = `${taskId}-${randomUUID()}${ext}`;
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  await fs.writeFile(path.join(PHOTOS_DIR, name), bytes);
  return {
    name,
    url: photoUrl(name),
    contentType,
    size: bytes.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function readPhoto(
  name: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const safe = safeFileName(name);
  if (!safe) return null;
  const contentType =
    EXT_TO_CONTENT_TYPE[path.extname(safe).toLowerCase()] ??
    "application/octet-stream";
  try {
    const bytes = await fs.readFile(path.join(PHOTOS_DIR, safe));
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/** Delete one photo file. Returns true when a file was removed. */
export async function deletePhoto(name: string): Promise<boolean> {
  const safe = safeFileName(name);
  if (!safe) return false;
  try {
    await fs.unlink(path.join(PHOTOS_DIR, safe));
    return true;
  } catch {
    return false;
  }
}

/** Delete every saved photo file (staff "Reset demo data"). */
export async function deleteAllPhotos(): Promise<void> {
  try {
    const names = await fs.readdir(PHOTOS_DIR);
    await Promise.all(
      names.map((name) =>
        fs.unlink(path.join(PHOTOS_DIR, name)).catch(() => undefined),
      ),
    );
  } catch {
    // No photos folder yet: nothing to delete.
  }
}
