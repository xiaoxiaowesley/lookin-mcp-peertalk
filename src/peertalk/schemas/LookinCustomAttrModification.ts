/**
 * LookinCustomAttrModification
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinCustomAttrModification.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "attrType"        -> NSInteger (LookinAttrType)
 *   "value"           -> id
 *   "customSetterID"  -> NSString
 */

import { asNumber, asStringOrNull, type UnarchiverContext } from "./_helpers.js";
import { LookinAttrType } from "./LookinAttrType.js";

export interface LookinCustomAttrModification {
  attrType: LookinAttrType;
  value: any;
  customSetterID: string | null;
}

export function decodeLookinCustomAttrModification(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinCustomAttrModification {
  return {
    attrType: asNumber(keys["attrType"], LookinAttrType.None) as LookinAttrType,
    value: keys["value"] ?? null,
    customSetterID: asStringOrNull(keys["customSetterID"]),
  };
}
