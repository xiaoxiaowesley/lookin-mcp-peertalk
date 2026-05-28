/**
 * LookinAttributesSection
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinAttributesSection.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "identifier" -> NSString (LookinAttrSecIdentifier)
 *   "attributes" -> NSArray<LookinAttribute>
 */

import { asArray, asStringOrNull, type UnarchiverContext } from "./_helpers.js";
import type { LookinAttribute } from "./LookinAttribute.js";

export interface LookinAttributesSection {
  identifier: string | null;
  attributes: LookinAttribute[];
}

export function decodeLookinAttributesSection(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinAttributesSection {
  return {
    identifier: asStringOrNull(keys["identifier"]),
    attributes: asArray<LookinAttribute>(keys["attributes"]),
  };
}
