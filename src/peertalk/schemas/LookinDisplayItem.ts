/**
 * LookinDisplayItem
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinDisplayItem.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "customInfo"               -> LookinCustomDisplayItemInfo | nil
 *   "subitems"                 -> NSArray<LookinDisplayItem>
 *   "hidden"                   -> BOOL                       (note: key is "hidden", property is isHidden)
 *   "alpha"                    -> float
 *   "viewObject"               -> LookinObject | nil
 *   "layerObject"              -> LookinObject | nil
 *   "hostViewControllerObject" -> LookinObject | nil
 *   "attributesGroupList"      -> NSArray<LookinAttributesGroup>
 *   "customAttrGroupList"      -> NSArray<LookinAttributesGroup>
 *   "representedAsKeyWindow"   -> BOOL
 *   "soloScreenshot"           -> NSData (image bytes) or LookinImage / nil
 *   "groupScreenshot"          -> NSData (image bytes) or LookinImage / nil
 *   "eventHandlers"            -> NSArray<LookinEventHandler>
 *   "shouldCaptureImage"       -> BOOL (default YES if absent)
 *   "customDisplayTitle"       -> NSString | nil
 *   "danceuiSource"            -> NSString | nil
 *   "frame" / "bounds"         -> CGRect (encoded as "{{x,y},{w,h}}" string)
 *   "backgroundColor"          -> NSArray<NSNumber> (RGBA components 0..1) | nil
 *
 * `isExpandable` is not directly encoded — on the ObjC side it is set to
 * `(subitems.count > 0)` whenever `subitems` is assigned in `setSubitems:`.
 * We mirror that derivation here so MCP callers can rely on the field.
 */

import {
  asArray,
  asBool,
  asNumber,
  asStringOrNull,
  normalizeImage,
  parseCGRect,
  type CGRect,
  type ImageData,
  type UnarchiverContext,
} from "./_helpers.js";
import type { LookinObject } from "./LookinObject.js";
import type { LookinAttributesGroup } from "./LookinAttributesGroup.js";
import type { LookinEventHandler } from "./LookinEventHandler.js";

export interface LookinDisplayItem {
  subitems: LookinDisplayItem[];

  frame: CGRect | null;
  bounds: CGRect | null;

  isHidden: boolean;
  alpha: number;

  viewObject: LookinObject | null;
  layerObject: LookinObject | null;
  hostViewControllerObject: LookinObject | null;

  soloScreenshot: ImageData | null;
  groupScreenshot: ImageData | null;

  attributesGroupList: LookinAttributesGroup[];
  customAttrGroupList: LookinAttributesGroup[];

  eventHandlers: LookinEventHandler[];

  customDisplayTitle: string | null;
  danceuiSource: string | null;

  shouldCaptureImage: boolean;
  representedAsKeyWindow: boolean;

  /** Background color RGBA (0..1) array if present, otherwise null. */
  backgroundColor: number[] | null;

  /** Custom info (UserCustom items) — pass through, may be null. */
  customInfo: any;

  /** Derived: subitems.length > 0. */
  isExpandable: boolean;
}

export function decodeLookinDisplayItem(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinDisplayItem {
  const subitems = asArray<LookinDisplayItem>(keys["subitems"]);
  const bgRaw = keys["backgroundColor"];
  const backgroundColor = Array.isArray(bgRaw)
    ? bgRaw
        .map((n) => (typeof n === "number" ? n : Number(n)))
        .filter((n) => Number.isFinite(n))
    : null;

  return {
    subitems,
    frame: parseCGRect(keys["frame"]),
    bounds: parseCGRect(keys["bounds"]),
    isHidden: asBool(keys["hidden"]),
    alpha: asNumber(keys["alpha"], 1),
    viewObject: (keys["viewObject"] as LookinObject | null) ?? null,
    layerObject: (keys["layerObject"] as LookinObject | null) ?? null,
    hostViewControllerObject:
      (keys["hostViewControllerObject"] as LookinObject | null) ?? null,
    soloScreenshot: normalizeImage(keys["soloScreenshot"]),
    groupScreenshot: normalizeImage(keys["groupScreenshot"]),
    attributesGroupList: asArray<LookinAttributesGroup>(keys["attributesGroupList"]),
    customAttrGroupList: asArray<LookinAttributesGroup>(keys["customAttrGroupList"]),
    eventHandlers: asArray<LookinEventHandler>(keys["eventHandlers"]),
    customDisplayTitle: asStringOrNull(keys["customDisplayTitle"]),
    danceuiSource: asStringOrNull(keys["danceuiSource"]),
    // shouldCaptureImage defaults to true if absent (Server >= 1.1.3 always encodes it).
    shouldCaptureImage:
      "shouldCaptureImage" in keys ? asBool(keys["shouldCaptureImage"]) : true,
    representedAsKeyWindow: asBool(keys["representedAsKeyWindow"]),
    backgroundColor: backgroundColor && backgroundColor.length > 0 ? backgroundColor : null,
    customInfo: keys["customInfo"] ?? null,
    isExpandable: subitems.length > 0,
  };
}
