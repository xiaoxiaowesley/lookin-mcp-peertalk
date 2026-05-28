/**
 * LookinConnectionAttachment / LookinConnectionResponseAttachment
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinConnectionAttachment.{h,m}`
 * and `LookinShared/Src/Main/Shared/LookinConnectionResponseAttachment.{h,m}`.
 *
 * Connection attachment NSCoding keys (from initWithCoder:):
 *   "0" (Key_Data)     -> NSData / id (depends on dataType, may decode further)
 *   "1" (Key_DataType) -> NSInteger (LookinConnectionAttachmentDataType)
 *
 * ResponseAttachment is a subclass that adds:
 *   "lookinServerVersion" -> int
 *   "appIsInBackground"   -> BOOL
 *   "dataTotalCount"      -> NSNumber (unsigned integer)
 *   "currentDataCount"    -> NSNumber (unsigned integer)
 *   "error"               -> NSError | nil
 */

import { asBool, asNumber, type UnarchiverContext } from "./_helpers.js";

// ────────────────────────────────────────────────────────────
// LookinConnectionAttachment
// ────────────────────────────────────────────────────────────

export interface LookinConnectionAttachment {
  data: any;
  dataType: number;
}

export function decodeLookinConnectionAttachment(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinConnectionAttachment {
  return {
    data: keys["0"] ?? null,
    dataType: asNumber(keys["1"]),
  };
}

// ────────────────────────────────────────────────────────────
// LookinConnectionResponseAttachment
// ────────────────────────────────────────────────────────────

export interface LookinConnectionResponseAttachment
  extends LookinConnectionAttachment {
  lookinServerVersion: number;
  appIsInBackground: boolean;
  dataTotalCount: number;
  currentDataCount: number;
  /** NSError or null. */
  error: any | null;
}

export function decodeLookinConnectionResponseAttachment(
  keys: Record<string, any>,
  ctx: UnarchiverContext
): LookinConnectionResponseAttachment {
  const base = decodeLookinConnectionAttachment(keys, ctx);
  return {
    ...base,
    lookinServerVersion: asNumber(keys["lookinServerVersion"]),
    appIsInBackground: asBool(keys["appIsInBackground"]),
    dataTotalCount: asNumber(keys["dataTotalCount"]),
    currentDataCount: asNumber(keys["currentDataCount"]),
    error: keys["error"] ?? null,
  };
}
