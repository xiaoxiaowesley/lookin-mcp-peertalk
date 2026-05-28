/**
 * LookinAttributeModification
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinAttributeModification.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "targetOid"             -> NSNumber (unsigned long)
 *   "setterSelector"        -> NSString (selector name string)
 *   "attrType"              -> NSInteger (LookinAttrType)
 *   "value"                 -> id
 *   "clientReadableVersion" -> NSString | nil
 */

import { asNumber, asStringOrNull, toOid, type UnarchiverContext } from "./_helpers.js";
import { LookinAttrType } from "./LookinAttrType.js";

export interface LookinAttributeModification {
  targetOid: number;
  setterSelector: string | null;
  attrType: LookinAttrType;
  value: any;
  clientReadableVersion: string | null;
}

export function decodeLookinAttributeModification(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinAttributeModification {
  return {
    targetOid: toOid(keys["targetOid"]),
    setterSelector: asStringOrNull(keys["setterSelector"]),
    attrType: asNumber(keys["attrType"], LookinAttrType.None) as LookinAttrType,
    value: keys["value"] ?? null,
    clientReadableVersion: asStringOrNull(keys["clientReadableVersion"]),
  };
}
