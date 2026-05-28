/**
 * LookinStaticAsyncUpdateTask & LookinStaticAsyncUpdateTasksPackage
 *
 * Mirrors `LookinShared/Src/Main/Shared/LookinStaticAsyncUpdateTask.{h,m}`.
 *
 * Task NSCoding keys (from initWithCoder:):
 *   "oid"                   -> NSNumber (unsigned long)
 *   "taskType"              -> NSInteger (LookinStaticAsyncUpdateTaskType)
 *   "clientReadableVersion" -> NSString | nil
 *   "attrRequest"           -> NSInteger (LookinDetailUpdateTaskAttrRequest)  (optional)
 *   "needBasisVisualInfo"   -> BOOL (optional, default NO)
 *   "needSubitems"          -> BOOL (optional, default NO)
 *
 * Package NSCoding keys:
 *   "tasks" -> NSArray<LookinStaticAsyncUpdateTask>
 */

import { asArray, asBool, asNumber, asStringOrNull, toOid, type UnarchiverContext } from "./_helpers.js";
import {
  LookinDetailUpdateTaskAttrRequest,
  LookinStaticAsyncUpdateTaskType,
} from "./LookinAttrType.js";

export interface LookinStaticAsyncUpdateTask {
  oid: number;
  taskType: LookinStaticAsyncUpdateTaskType;
  clientReadableVersion: string | null;
  attrRequest: LookinDetailUpdateTaskAttrRequest;
  needBasisVisualInfo: boolean;
  needSubitems: boolean;
}

export function decodeLookinStaticAsyncUpdateTask(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinStaticAsyncUpdateTask {
  let attrRequest: LookinDetailUpdateTaskAttrRequest =
    LookinDetailUpdateTaskAttrRequest.Automatic;
  if ("attrRequest" in keys) {
    const v = asNumber(keys["attrRequest"]);
    if (
      v >= LookinDetailUpdateTaskAttrRequest.Automatic &&
      v <= LookinDetailUpdateTaskAttrRequest.NotNeed
    ) {
      attrRequest = v as LookinDetailUpdateTaskAttrRequest;
    }
  }

  return {
    oid: toOid(keys["oid"]),
    taskType: asNumber(
      keys["taskType"],
      LookinStaticAsyncUpdateTaskType.NoScreenshot
    ) as LookinStaticAsyncUpdateTaskType,
    clientReadableVersion: asStringOrNull(keys["clientReadableVersion"]),
    attrRequest,
    needBasisVisualInfo: asBool(keys["needBasisVisualInfo"]),
    needSubitems: asBool(keys["needSubitems"]),
  };
}

// ────────────────────────────────────────────────────────────
// LookinStaticAsyncUpdateTasksPackage
// ────────────────────────────────────────────────────────────

export interface LookinStaticAsyncUpdateTasksPackage {
  tasks: LookinStaticAsyncUpdateTask[];
}

export function decodeLookinStaticAsyncUpdateTasksPackage(
  keys: Record<string, any>,
  _ctx: UnarchiverContext
): LookinStaticAsyncUpdateTasksPackage {
  return {
    tasks: asArray<LookinStaticAsyncUpdateTask>(keys["tasks"]),
  };
}
