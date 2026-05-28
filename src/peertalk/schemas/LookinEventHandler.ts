/**
 * LookinEventHandler
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinEventHandler.{h,m}`.
 *
 * NSCoding keys (from initWithCoder:):
 *   "handlerType"                -> NSInteger (LookinEventHandlerType)
 *   "gestureRecognizerIsEnabled" -> BOOL
 *   "eventName"                  -> NSString | nil
 *   "gestureRecognizerDelegator" -> NSString | nil
 *   "targetActions"              -> NSArray<LookinStringTwoTuple>
 *   "inheritedRecognizerName"    -> NSString | nil
 *   "recognizerIvarTraces"       -> NSArray<NSString>
 *   "recognizerOid"              -> NSNumber (unsigned long long)
 */

import {
  asArray,
  asBool,
  asNumber,
  asStringOrNull,
  toOid,
  type UnarchiverContext,
} from "./_helpers.js";
import { LookinEventHandlerType } from "./LookinAttrType.js";

export interface LookinEventHandler {
  handlerType: LookinEventHandlerType;
  eventName: string | null;
  /**
   * Each tuple ~ { first: target description, second: action selector name }.
   * LookinStringTwoTuple is a separate class but we surface its fields directly.
   */
  targetActions: any[];
  inheritedRecognizerName: string | null;
  gestureRecognizerIsEnabled: boolean;
  gestureRecognizerDelegator: string | null;
  recognizerIvarTraces: string[];
  recognizerOid: number;
}

export function decodeLookinEventHandler(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinEventHandler {
  const recognizerIvarTracesRaw = asArray<any>(keys["recognizerIvarTraces"]);
  return {
    handlerType: asNumber(
      keys["handlerType"],
      LookinEventHandlerType.TargetAction
    ) as LookinEventHandlerType,
    eventName: asStringOrNull(keys["eventName"]),
    targetActions: asArray(keys["targetActions"]),
    inheritedRecognizerName: asStringOrNull(keys["inheritedRecognizerName"]),
    gestureRecognizerIsEnabled: asBool(keys["gestureRecognizerIsEnabled"]),
    gestureRecognizerDelegator: asStringOrNull(keys["gestureRecognizerDelegator"]),
    recognizerIvarTraces: recognizerIvarTracesRaw.filter(
      (s): s is string => typeof s === "string"
    ),
    recognizerOid: toOid(keys["recognizerOid"]),
  };
}
