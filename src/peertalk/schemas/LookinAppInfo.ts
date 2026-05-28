/**
 * LookinAppInfo
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinAppInfo.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "1" (CodingKey_AppIcon)            -> NSData (PNG/TIFF bytes)
 *   "2" (CodingKey_Screenshot)         -> NSData (PNG/TIFF bytes)
 *   "3" (CodingKey_DeviceDescription)  -> NSString
 *   "4" (CodingKey_OsDescription)      -> NSString
 *   "5" (CodingKey_AppName)            -> NSString
 *   "6" (CodingKey_ScreenWidth)        -> double
 *   "7" (CodingKey_ScreenHeight)       -> double
 *   "8" (CodingKey_DeviceType)         -> NSInteger (LookinAppInfoDevice)
 *   "appBundleIdentifier"              -> NSString
 *   "appInfoIdentifier"                -> NSInteger
 *   "osMainVersion"                    -> NSInteger
 *   "screenScale"                      -> double
 *   "serverVersion"                    -> int
 *   "serverReadableVersion"            -> NSString
 *   "swiftEnabledInLookinServer"       -> int
 *   "shouldUseCache"                   -> BOOL
 */

import {
  asBool,
  asNumber,
  asStringOrNull,
  normalizeImage,
  type ImageData,
  type UnarchiverContext,
} from "./_helpers.js";
import { LookinAppInfoDevice } from "./LookinAttrType.js";

export interface LookinAppInfo {
  appName: string | null;
  appBundleIdentifier: string | null;
  deviceDescription: string | null;
  osDescription: string | null;
  deviceType: LookinAppInfoDevice;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  serverVersion: number;
  serverReadableVersion: string | null;
  swiftEnabledInLookinServer: number;
  /** App's current screenshot, decoded as raw image bytes. */
  screenshot: ImageData | null;
  /** App icon, decoded as raw image bytes. May be nil for empty projects. */
  appIcon: ImageData | null;
  appInfoIdentifier: number;
  osMainVersion: number;
  shouldUseCache: boolean;
}

export function decodeLookinAppInfo(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinAppInfo {
  return {
    appName: asStringOrNull(keys["5"]),
    appBundleIdentifier: asStringOrNull(keys["appBundleIdentifier"]),
    deviceDescription: asStringOrNull(keys["3"]),
    osDescription: asStringOrNull(keys["4"]),
    deviceType: asNumber(keys["8"], LookinAppInfoDevice.Others) as LookinAppInfoDevice,
    screenWidth: asNumber(keys["6"]),
    screenHeight: asNumber(keys["7"]),
    screenScale: asNumber(keys["screenScale"]),
    serverVersion: asNumber(keys["serverVersion"]),
    serverReadableVersion: asStringOrNull(keys["serverReadableVersion"]),
    swiftEnabledInLookinServer: asNumber(keys["swiftEnabledInLookinServer"]),
    screenshot: normalizeImage(keys["2"]),
    appIcon: normalizeImage(keys["1"]),
    appInfoIdentifier: asNumber(keys["appInfoIdentifier"]),
    osMainVersion: asNumber(keys["osMainVersion"]),
    shouldUseCache: asBool(keys["shouldUseCache"]),
  };
}
