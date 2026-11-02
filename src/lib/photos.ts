import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
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

/** PC1: every saved photo is resized to at most this on its long side. */
export const MAX_PHOTO_LONG_SIDE = 2048;

/** PC1: the one clear message when a photo cannot be used at all. */
export const PHOTO_FORMAT_MESSAGE =
  "This photo format isn't supported. Please use JPG or PNG.";

/** Thrown when a photo cannot be converted/resized. Never swallowed. */
export class PhotoFormatError extends Error {
  constructor(message = PHOTO_FORMAT_MESSAGE) {
    super(message);
    this.name = "PhotoFormatError";
  }
}

/** HEIC/HEIF files start with an ISO-BMFF "ftyp" box (heic/heix/mif1/...). */
export function looksLikeHeic(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  if (bytes.toString("latin1", 4, 8) !== "ftyp") return false;
  const brand = bytes.toString("latin1", 8, 12).toLowerCase();
  return ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "mif2", "msf1"].includes(brand);
}

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTS = new Set([".heic", ".heif"]);

/**
 * Accept a photo upload: by content type, by file-name extension, or by
 * HEIC magic bytes (some browsers send HEIC with an empty type).
 */
export function isAcceptedPhotoUpload(
  bytes: Buffer,
  contentType: string,
  fileName = "",
): boolean {
  if (isSupportedPhotoType(contentType)) return true;
  const ext = path.extname(fileName).toLowerCase();
  if (ext && Object.values(CONTENT_TYPE_TO_EXT).includes(ext)) return true;
  return looksLikeHeic(bytes);
}

/**
 * PC1: normalize one uploaded photo before it is saved or sent to the AI.
 * HEIC/HEIF is converted to JPEG (heic-convert / libheif), everything is
 * auto-rotated and resized to max 2048px on the long side, and the result
 * is always JPEG. Throws PhotoFormatError when conversion fails — callers
 * must show PHOTO_FORMAT_MESSAGE and never continue silently.
 */
export async function normalizePhotoBytes(
  bytes: Buffer,
  contentType: string,
  fileName = "",
): Promise<{ bytes: Buffer; contentType: "image/jpeg" }> {
  const ext = path.extname(fileName).toLowerCase();
  const isHeic =
    HEIC_TYPES.has(contentType) || HEIC_EXTS.has(ext) || looksLikeHeic(bytes);
  let input = bytes;
  if (isHeic) {
    try {
      const convert = (await import("heic-convert")).default;
      const converted = await convert({
        buffer: bytes,
        format: "JPEG",
        quality: 0.92,
      });
      input = Buffer.from(converted);
    } catch {
      throw new PhotoFormatError();
    }
  }
  try {
    const out = await sharp(input)
      .rotate()
      .resize({
        width: MAX_PHOTO_LONG_SIDE,
        height: MAX_PHOTO_LONG_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { bytes: out, contentType: "image/jpeg" };
  } catch {
    throw new PhotoFormatError();
  }
}

/** SHA-256 of photo bytes — the AI-check cache key (PC1 part 3). */
export function photoHash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

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
  fileName = "",
): Promise<TaskPhoto> {
  if (!isAcceptedPhotoUpload(bytes, contentType, fileName)) {
    throw new PhotoFormatError();
  }
  // PC1: HEIC -> JPEG + resize to max 2048px before saving. A failure
  // throws PhotoFormatError; nothing is saved and callers show the clear
  // format message instead of continuing silently.
  const normalized = await normalizePhotoBytes(bytes, contentType, fileName);
  const name = `${taskId}-${randomUUID()}.jpg`;
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  await fs.writeFile(path.join(PHOTOS_DIR, name), normalized.bytes);
  return {
    name,
    url: photoUrl(name),
    contentType: normalized.contentType,
    size: normalized.bytes.length,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Read one saved photo as a JPEG data URL for an AI call. Saved photos are
 * already normalized JPEGs; legacy HEIC/oversized files are converted and
 * resized in memory here (never re-saved silently under a fake result).
 */
export async function readPhotoDataUrl(name: string): Promise<string | null> {
  const stored = await readPhoto(name);
  if (!stored) return null;
  if (stored.contentType === "image/jpeg" && !looksLikeHeic(stored.bytes)) {
    // Still enforce the long-side cap for legacy oversized JPEGs.
    try {
      const meta = await sharp(stored.bytes).metadata();
      if (
        (meta.width ?? 0) <= MAX_PHOTO_LONG_SIDE &&
        (meta.height ?? 0) <= MAX_PHOTO_LONG_SIDE
      ) {
        return `data:image/jpeg;base64,${stored.bytes.toString("base64")}`;
      }
    } catch {
      throw new PhotoFormatError();
    }
  }
  const normalized = await normalizePhotoBytes(
    stored.bytes,
    stored.contentType,
    name,
  );
  return `data:image/jpeg;base64,${normalized.bytes.toString("base64")}`;
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
