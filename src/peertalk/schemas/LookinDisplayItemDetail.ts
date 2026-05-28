/**
 * LookinDisplayItemDetail
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinDisplayItemDetail.{h,m}`.
 *
 * This object is returned by the server in response to async update tasks.
 *
 * NSCoding keys (from initWithCoder:):
 *   "displayItemOid"      -> NSNumber (unsigned long)
 *   "groupScreenshot"     -> NSData (image bytes)
 *   "soloScreenshot"      -> NSData (image bytes)
 *   "frameValue"          -> NSValue (NSString from CGRect) | nil
 *   "boundsValue"         -> NSValue (NSString from CGRect) | nil
 *   "hiddenValue"         -> NSNumber | nil
 *   "alphaValue"          -> NSNumber | nil
 *   "attributesGroupList" -> NSArray<LookinAttributesGroup>
 *   "customAttrGroupList" -> NSArray<LookinAttributesGroup>
 *   "customDisplayTitle"  -> NSString | nil
 *   "danceUISource"       -> NSString | nil
 *   "failureCode"         -> NSInteger (optional, default 0)
 *   "subitems"            -> NSArray<LookinDisplayItem> | nil (optional)
 */

import {
  asArray,
  asNumber,
  asStringOrNull,
  normalizeImage,
  toOid,
  type ImageData,
  type UnarchiverContext,
} from "./_helpers.js";
import type { LookinAttributesGroup } from "./LookinAttributesGroup.js";
import type { LookinDisplayItem } from "./LookinDisplayItem.js";

export interface LookinDisplayItemDetail {
  displayItemOid: number;
  groupScreenshot: ImageData | null;
  soloScreenshot: ImageData | null;
  frameValue: any;
  boundsValue: any;
  hiddenValue: any;
  alphaValue: any;
  attributesGroupList: LookinAttributesGroup[];
  customAttrGroupList: LookinAttributesGroup[];
  customDisplayTitle: string | null;
  danceUISource: string | null;
  failureCode: number;
  subitems: LookinDisplayItem[] | null;
}

export function decodeLookinDisplayItemDetail(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinDisplayItemDetail {
  return {
    displayItemOid: toOid(keys["displayItemOid"]),
    groupScreenshot: normalizeImage(keys["groupScreenshot"]),
    soloScreenshot: normalizeImage(keys["soloScreenshot"]),
    frameValue: keys["frameValue"] ?? null,
    boundsValue: keys["boundsValue"] ?? null,
    hiddenValue: keys["hiddenValue"] ?? null,
    alphaValue: keys["alphaValue"] ?? null,
    attributesGroupList: asArray<LookinAttributesGroup>(keys["attributesGroupList"]),
    customAttrGroupList: asArray<LookinAttributesGroup>(keys["customAttrGroupList"]),
    customDisplayTitle: asStringOrNull(keys["customDisplayTitle"]),
    danceUISource: asStringOrNull(keys["danceUISource"]),
    failureCode: asNumber(keys["failureCode"]),
    subitems: "subitems" in keys ? asArray<LookinDisplayItem>(keys["subitems"]) : null,
  };
}
