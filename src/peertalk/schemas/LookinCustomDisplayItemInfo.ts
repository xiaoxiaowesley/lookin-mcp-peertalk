/**
 * LookinCustomDisplayItemInfo
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinCustomDisplayItemInfo.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "frameInWindow" -> NSValue (CGRect) | nil
 *   "title"         -> NSString | nil
 *   "subtitle"      -> NSString | nil
 *   "danceuiSource" -> NSString | nil
 */

import { asStringOrNull, parseCGRect, type CGRect, type UnarchiverContext } from "./_helpers.js";

export interface LookinCustomDisplayItemInfo {
  frameInWindow: CGRect | null;
  title: string | null;
  subtitle: string | null;
  danceuiSource: string | null;
}

export function decodeLookinCustomDisplayItemInfo(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinCustomDisplayItemInfo {
  return {
    frameInWindow: parseCGRect(keys["frameInWindow"]),
    title: asStringOrNull(keys["title"]),
    subtitle: asStringOrNull(keys["subtitle"]),
    danceuiSource: asStringOrNull(keys["danceuiSource"]),
  };
}
