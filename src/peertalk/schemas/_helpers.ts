/**
 * Shared utility helpers used by Lookin* class decoders.
 */

import type { UnarchiverContext } from "../keyed-unarchiver.js";

export interface CGRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageData {
  imageData: Buffer;
  format: "png" | "jpeg" | "unknown";
}

/**
 * Cocoa's `encodeCGRect:forKey:` writes the rect as the string
 *   "{{x, y}, {w, h}}"
 * via NSStringFromCGRect. Parse that string back into numeric fields.
 *
 * Also tolerates already-parsed shapes (some archives use NSValue / arrays).
 */
export function parseCGRect(v: any): CGRect | null {
  if (v == null) return null;
  if (typeof v === "object" && !Array.isArray(v)) {
    if (
      typeof (v as any).x === "number" &&
      typeof (v as any).y === "number" &&
      typeof (v as any).width === "number" &&
      typeof (v as any).height === "number"
    ) {
      return {
        x: (v as any).x,
        y: (v as any).y,
        width: (v as any).width,
        height: (v as any).height,
      };
    }
  }
  if (Array.isArray(v) && v.length >= 4) {
    return { x: Number(v[0]), y: Number(v[1]), width: Number(v[2]), height: Number(v[3]) };
  }
  if (typeof v === "string") {
    const nums = v.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
    if (nums && nums.length >= 4) {
      return {
        x: parseFloat(nums[0]),
        y: parseFloat(nums[1]),
        width: parseFloat(nums[2]),
        height: parseFloat(nums[3]),
      };
    }
  }
  return null;
}

function detectImageFormat(buf: Buffer): "png" | "jpeg" | "unknown" {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return "png";
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "jpeg";
    }
  }
  return "unknown";
}

/**
 * Normalize a screenshot/icon field that may have arrived as either:
 *   - a Buffer (NSData encoded image bytes), or
 *   - an object { imageData, format } already produced by the UIImage decoder, or
 *   - null / unknown
 */
export function normalizeImage(v: any): ImageData | null {
  if (v == null) return null;
  if (Buffer.isBuffer(v)) {
    return { imageData: v, format: detectImageFormat(v) };
  }
  if (typeof v === "object" && Buffer.isBuffer((v as any).imageData)) {
    const format = (v as any).format;
    return {
      imageData: (v as any).imageData,
      format:
        format === "png" || format === "jpeg" || format === "unknown"
          ? format
          : detectImageFormat((v as any).imageData),
    };
  }
  return null;
}

/** Coerce a value that should be a non-negative oid (unsigned long). */
export function toOid(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Generic helper — get array or empty array. */
export function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Generic helper — string or null. */
export function asStringOrNull(v: any): string | null {
  return typeof v === "string" ? v : null;
}

/** Generic helper — number or 0. */
export function asNumber(v: any, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return fallback;
}

/** Generic helper — boolean or false. */
export function asBool(v: any, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return fallback;
}

// Re-export the UnarchiverContext type so schema files only need one import.
export type { UnarchiverContext };
