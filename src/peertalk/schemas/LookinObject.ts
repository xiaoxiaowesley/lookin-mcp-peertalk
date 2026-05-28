/**
 * LookinObject
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinObject.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "oid"            -> NSNumber (unsigned long)
 *   "memoryAddress"  -> NSString (e.g. "0x102345abc")
 *   "classChainList" -> NSArray<NSString>  (e.g. ["UILabel","UIView","UIResponder","NSObject"])
 *   "specialTrace"   -> NSString | nil
 *   "ivarTraces"     -> NSArray<LookinIvarTrace>
 */

import { asArray, asStringOrNull, toOid, type UnarchiverContext } from "./_helpers.js";
import type { LookinIvarTrace } from "./LookinIvarTrace.js";

export interface LookinObject {
  oid: number;
  memoryAddress: string | null;
  classChainList: string[];
  specialTrace: string | null;
  ivarTraces: LookinIvarTrace[];
}

export function decodeLookinObject(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinObject {
  const classChainListRaw = asArray<any>(keys["classChainList"]);
  const ivarTracesRaw = asArray<any>(keys["ivarTraces"]);

  return {
    oid: toOid(keys["oid"]),
    memoryAddress: asStringOrNull(keys["memoryAddress"]),
    classChainList: classChainListRaw.filter((s): s is string => typeof s === "string"),
    specialTrace: asStringOrNull(keys["specialTrace"]),
    ivarTraces: ivarTracesRaw as LookinIvarTrace[],
  };
}
