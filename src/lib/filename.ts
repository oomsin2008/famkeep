const FORBIDDEN_FILENAME_CHARS = /[\/\\:*?"<>|]+/g;
const MAX_FILENAME_LENGTH = 80;

function splitName(name: string): { stem: string; ext: string } {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot < base.length - 1) {
    const ext = base.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
    if (ext) return { stem: base.slice(0, dot), ext: ext.toLowerCase() };
  }
  return { stem: base || "jpg", ext: "jpg" };
}

function normalizeText(input: string): string {
  return input
    .replace(FORBIDDEN_FILENAME_CHARS, " ")
    .replace(new RegExp("[\u0000-\u001f\u007f]", "g"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripFilenameExtension(input: string): string {
  const dot = input.lastIndexOf(".");
  if (dot <= 0 || dot >= input.length - 1) return input;
  const ext = input.slice(dot + 1);
  return /^[A-Za-z0-9]{1,10}$/.test(ext) ? input.slice(0, dot) : input;
}

function bangkokFallbackStamp(date = new Date()): string {
  const bkk = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${bkk.getUTCFullYear()}-${p(bkk.getUTCMonth() + 1)}-${p(
    bkk.getUTCDate(),
  )}_${p(bkk.getUTCHours())}${p(bkk.getUTCMinutes())}`;
}

export function fallbackImageFilename(
  originalName: string,
  date = new Date(),
): string {
  const { ext } = splitName(originalName);
  return `รูป_${bangkokFallbackStamp(date)}.${ext}`;
}

export function sanitizeFilename(
  stem: string,
  originalName: string,
  date = new Date(),
): string {
  const { ext } = splitName(originalName);
  const normalized = normalizeText(stem);
  if (!normalized) return fallbackImageFilename(originalName, date);

  const suffix = `.${ext}`;
  const maxStem = Math.max(1, MAX_FILENAME_LENGTH - suffix.length);
  const cleanStem = stripFilenameExtension(normalized).slice(0, maxStem).trim();
  return `${cleanStem || "รูป"}${suffix}`;
}

/**
 * Default filename shown in the upload dialog: the picked file's own name,
 * sanitized. Falls back to a Bangkok timestamp only when the original stem
 * carries no usable text at all.
 */
export function defaultFilenameFromOriginal(
  originalName: string,
  date = new Date(),
): string {
  const { stem } = splitName(originalName);
  const normalized = normalizeText(stripFilenameExtension(stem));
  const meaningful = normalized.replace(/[\s_.\-]+/g, "");
  if (meaningful.length < 2) return fallbackImageFilename(originalName, date);
  return sanitizeFilename(normalized, originalName, date);
}
