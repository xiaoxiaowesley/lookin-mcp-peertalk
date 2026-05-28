/**
 * LookinHierarchyInfo
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinHierarchyInfo.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "1" (LookinHierarchyInfoCodingKey_DisplayItems)        -> NSArray<LookinDisplayItem>
 *   "2" (LookinHierarchyInfoCodingKey_AppInfo)             -> LookinAppInfo
 *   "3" (LookinHierarchyInfoCodingKey_ColorAlias)          -> NSDictionary<NSString,id>
 *   "4" (LookinHierarchyInfoCodingKey_CollapsedClassList)  -> NSArray<NSString>
 *   "serverVersion"                                        -> int
 */

import { asArray, asNumber, type UnarchiverContext } from "./_helpers.js";
import type { LookinAppInfo } from "./LookinAppInfo.js";
import type { LookinDisplayItem } from "./LookinDisplayItem.js";

export interface LookinHierarchyInfo {
  /** Top-level UIWindows. */
  displayItems: LookinDisplayItem[];
  appInfo: LookinAppInfo | null;
  colorAlias: Record<string, any>;
  collapsedClassList: string[];
  serverVersion: number;
}

export function decodeLookinHierarchyInfo(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinHierarchyInfo {
  const collapsedRaw = asArray<any>(keys["4"]);
  const colorAliasRaw = keys["3"];
  return {
    displayItems: asArray<LookinDisplayItem>(keys["1"]),
    appInfo: (keys["2"] as LookinAppInfo | null) ?? null,
    colorAlias:
      colorAliasRaw && typeof colorAliasRaw === "object" && !Array.isArray(colorAliasRaw)
        ? (colorAliasRaw as Record<string, any>)
        : {},
    collapsedClassList: collapsedRaw.filter((s): s is string => typeof s === "string"),
    serverVersion: asNumber(keys["serverVersion"]),
  };
}
