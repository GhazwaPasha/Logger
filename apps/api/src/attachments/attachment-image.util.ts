import sharp from "sharp";

const MAX_EDGE_PX = 1920;
const WEBP_QUALITY = 82;
/** Skip re-encoding tiny images (icons, thumbnails). */
const MIN_BYTES_TO_COMPRESS = 32 * 1024;

function storageSuffixForMime(mimeType: string): string {
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/svg+xml") return ".svg";
  return "";
}

export type PreparedUploadBytes = {
  buffer: Buffer;
  mimeType: string;
  /** File extension for content-addressed R2 key (e.g. `.webp`). */
  storageSuffix: string;
};

/**
 * Resize and WebP-encode large raster images. GIF/SVG and small files are left as-is.
 */
export async function prepareUploadBytes(buffer: Buffer, mimeType: string): Promise<PreparedUploadBytes> {
  if (!mimeType.startsWith("image/")) {
    return { buffer, mimeType, storageSuffix: "" };
  }
  if (mimeType === "image/gif" || mimeType === "image/svg+xml") {
    return { buffer, mimeType, storageSuffix: storageSuffixForMime(mimeType) };
  }
  if (buffer.length < MIN_BYTES_TO_COMPRESS) {
    return { buffer, mimeType, storageSuffix: storageSuffixForMime(mimeType) };
  }

  try {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    if (out.length >= buffer.length * 0.95) {
      return { buffer, mimeType, storageSuffix: storageSuffixForMime(mimeType) };
    }
    return { buffer: out, mimeType: "image/webp", storageSuffix: ".webp" };
  } catch {
    return { buffer, mimeType, storageSuffix: storageSuffixForMime(mimeType) };
  }
}
