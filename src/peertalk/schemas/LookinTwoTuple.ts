/**
 * LookinTwoTuple / LookinStringTwoTuple
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinTuple.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "first"  -> id / NSString
 *   "second" -> id / NSString
 */

import type { UnarchiverContext } from "./_helpers.js";

export interface LookinTwoTuple {
  first: any;
  second: any;
}

export function decodeLookinTwoTuple(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinTwoTuple {
  return {
    first: keys["first"] ?? null,
    second: keys["second"] ?? null,
  };
}

/** LookinStringTwoTuple is a subclass with same coding; fields are typed as string. */
export interface LookinStringTwoTuple {
  first: string | null;
  second: string | null;
}

export function decodeLookinStringTwoTuple(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinStringTwoTuple {
  const f = keys["first"];
  const s = keys["second"];
  return {
    first: typeof f === "string" ? f : f == null ? null : String(f),
    second: typeof s === "string" ? s : s == null ? null : String(s),
  };
}
