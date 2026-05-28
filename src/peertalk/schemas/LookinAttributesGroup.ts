/**
 * LookinAttributesGroup
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinAttributesGroup.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "userCustomTitle" -> NSString | nil  (only present when isUserCustom)
 *   "identifier"      -> NSString (LookinAttrGroupIdentifier)
 *   "attrSections"    -> NSArray<LookinAttributesSection>
 *
 * isUserCustom is derived: true iff identifier === "GroupID-UserCustom".
 */

import { asArray, asStringOrNull, type UnarchiverContext } from "./_helpers.js";
import type { LookinAttributesSection } from "./LookinAttributesSection.js";

/** Mirrors `LookinAttrGroup_UserCustom` from LookinAttrIdentifiers.h. */
export const LookinAttrGroup_UserCustom = "GroupID-UserCustom";

export interface LookinAttributesGroup {
  identifier: string | null;
  attrSections: LookinAttributesSection[];
  /** Only meaningful when isUserCustom === true. */
  userCustomTitle: string | null;
  /** Derived from identifier. */
  isUserCustom: boolean;
}

export function decodeLookinAttributesGroup(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinAttributesGroup {
  const identifier = asStringOrNull(keys["identifier"]);
  return {
    identifier,
    attrSections: asArray<LookinAttributesSection>(keys["attrSections"]),
    userCustomTitle: asStringOrNull(keys["userCustomTitle"]),
    isUserCustom: identifier === LookinAttrGroup_UserCustom,
  };
}
