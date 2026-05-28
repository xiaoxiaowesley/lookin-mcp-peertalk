/**
 * LookinIvarTrace
 *
 * Mirrors `LookinShared/Src/Base/LookinIvarTrace.{h,m}`.
 * NSCoding keys: "relation", "hostClassName", "ivarName".
 */

import { asStringOrNull, type UnarchiverContext } from "./_helpers.js";

export interface LookinIvarTrace {
  /** "superview" / "superlayer" / "self" / null */
  relation: string | null;
  hostClassName: string | null;
  ivarName: string | null;
}

export function decodeLookinIvarTrace(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinIvarTrace {
  return {
    relation: asStringOrNull(keys["relation"]),
    hostClassName: asStringOrNull(keys["hostClassName"]),
    ivarName: asStringOrNull(keys["ivarName"]),
  };
}
