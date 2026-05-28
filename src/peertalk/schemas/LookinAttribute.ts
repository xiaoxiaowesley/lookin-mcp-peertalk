/**
 * LookinAttribute
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinAttribute.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "displayTitle"   -> NSString | nil   (only Custom Attr)
 *   "identifier"     -> NSString          (LookinAttrIdentifier)
 *   "attrType"       -> NSInteger (LookinAttrType)
 *   "value"          -> id (depends on attrType, may be nil)
 *   "extraValue"     -> id | nil
 *   "customSetterID" -> NSString | nil   (only Custom Attr)
 */

import { asNumber, asStringOrNull, type UnarchiverContext } from "./_helpers.js";
import { LookinAttrType } from "./LookinAttrType.js";

export interface LookinAttribute {
  /** LookinAttrIdentifier — string id for attribute (e.g. "view.backgroundColor"). */
  identifier: string | null;
  attrType: LookinAttrType;
  /** Concrete value, type depends on attrType — may be nil. */
  value: any;
  /** Extra value, mostly nil; for EnumString it's the list of all enum cases. */
  extraValue: any;
  /** Custom-attr only display title. */
  displayTitle: string | null;
  /** Custom-attr only setter id. */
  customSetterID: string | null;
}

export function decodeLookinAttribute(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinAttribute {
  return {
    identifier: asStringOrNull(keys["identifier"]),
    attrType: asNumber(keys["attrType"], LookinAttrType.None) as LookinAttrType,
    value: keys["value"] ?? null,
    extraValue: keys["extraValue"] ?? null,
    displayTitle: asStringOrNull(keys["displayTitle"]),
    customSetterID: asStringOrNull(keys["customSetterID"]),
  };
}
