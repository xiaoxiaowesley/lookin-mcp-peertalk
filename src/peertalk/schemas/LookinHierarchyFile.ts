/**
 * LookinHierarchyFile
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinHierarchyFile.{h,m}`.
 *
 * Used when reading/writing `.lookin` archive files.
 *
 * NSCoding keys (from initWithCoder:):
 *   "serverVersion"   -> int
 *   "hierarchyInfo"   -> LookinHierarchyInfo
 *   "soloScreenshots" -> NSDictionary | nil
 *   "groupScreenshots"-> NSDictionary | nil
 */

import { asNumber, type UnarchiverContext } from "./_helpers.js";
import type { LookinHierarchyInfo } from "./LookinHierarchyInfo.js";

export interface LookinHierarchyFile {
  serverVersion: number;
  hierarchyInfo: LookinHierarchyInfo | null;
  soloScreenshots: Record<string, any> | null;
  groupScreenshots: Record<string, any> | null;
}

export function decodeLookinHierarchyFile(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinHierarchyFile {
  const soloRaw = keys["soloScreenshots"];
  const groupRaw = keys["groupScreenshots"];
  return {
    serverVersion: asNumber(keys["serverVersion"]),
    hierarchyInfo: (keys["hierarchyInfo"] as LookinHierarchyInfo | null) ?? null,
    soloScreenshots:
      soloRaw && typeof soloRaw === "object" && !Array.isArray(soloRaw)
        ? soloRaw
        : null,
    groupScreenshots:
      groupRaw && typeof groupRaw === "object" && !Array.isArray(groupRaw)
        ? groupRaw
        : null,
  };
}
