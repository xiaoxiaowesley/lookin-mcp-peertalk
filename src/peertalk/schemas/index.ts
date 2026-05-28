/**
 * Schema registry — side-effect import.
 *
 * Importing this module registers all Lookin* class decoders with the
 * keyed-unarchiver so that `unarchive()` can recognise them.
 *
 * Usage (call once at startup):
 *   import './peertalk/schemas/index.js';
 */

import { registerClass } from "../keyed-unarchiver.js";

// ── Decode functions ───────────────────────────────────────────────────────
import { decodeLookinIvarTrace } from "./LookinIvarTrace.js";
import { decodeLookinObject } from "./LookinObject.js";
import { decodeLookinAttribute } from "./LookinAttribute.js";
import { decodeLookinAttributesSection } from "./LookinAttributesSection.js";
import { decodeLookinAttributesGroup } from "./LookinAttributesGroup.js";
import { decodeLookinEventHandler } from "./LookinEventHandler.js";
import { decodeLookinAppInfo } from "./LookinAppInfo.js";
import { decodeLookinDisplayItem } from "./LookinDisplayItem.js";
import { decodeLookinHierarchyInfo } from "./LookinHierarchyInfo.js";
import {
  decodeLookinConnectionAttachment,
  decodeLookinConnectionResponseAttachment,
} from "./LookinConnectionResponseAttachment.js";
import { decodeLookinAttributeModification } from "./LookinAttributeModification.js";
import {
  decodeLookinStaticAsyncUpdateTask,
  decodeLookinStaticAsyncUpdateTasksPackage,
} from "./LookinStaticAsyncUpdateTask.js";
import {
  decodeLookinTwoTuple,
  decodeLookinStringTwoTuple,
} from "./LookinTwoTuple.js";
import { decodeLookinCustomDisplayItemInfo } from "./LookinCustomDisplayItemInfo.js";
import { decodeLookinDisplayItemDetail } from "./LookinDisplayItemDetail.js";
import { decodeLookinCustomAttrModification } from "./LookinCustomAttrModification.js";
import { decodeLookinHierarchyFile } from "./LookinHierarchyFile.js";

// ── Register all Lookin* classes ──────────────────────────────────────────
registerClass("LookinIvarTrace", decodeLookinIvarTrace);
registerClass("LookinObject", decodeLookinObject);
registerClass("LookinAttribute", decodeLookinAttribute);
registerClass("LookinAttributesSection", decodeLookinAttributesSection);
registerClass("LookinAttributesGroup", decodeLookinAttributesGroup);
registerClass("LookinEventHandler", decodeLookinEventHandler);
registerClass("LookinAppInfo", decodeLookinAppInfo);
registerClass("LookinDisplayItem", decodeLookinDisplayItem);
registerClass("LookinHierarchyInfo", decodeLookinHierarchyInfo);
registerClass("LookinConnectionAttachment", decodeLookinConnectionAttachment);
registerClass("LookinConnectionResponseAttachment", decodeLookinConnectionResponseAttachment);
registerClass("LookinAttributeModification", decodeLookinAttributeModification);
registerClass("LookinStaticAsyncUpdateTask", decodeLookinStaticAsyncUpdateTask);
registerClass("LookinStaticAsyncUpdateTasksPackage", decodeLookinStaticAsyncUpdateTasksPackage);
registerClass("LookinTwoTuple", decodeLookinTwoTuple);
registerClass("LookinStringTwoTuple", decodeLookinStringTwoTuple);
registerClass("LookinCustomDisplayItemInfo", decodeLookinCustomDisplayItemInfo);
registerClass("LookinDisplayItemDetail", decodeLookinDisplayItemDetail);
registerClass("LookinCustomAttrModification", decodeLookinCustomAttrModification);
registerClass("LookinHierarchyFile", decodeLookinHierarchyFile);

// ── Re-export all interfaces & decode functions for external use ───────────
export { type LookinIvarTrace, decodeLookinIvarTrace } from "./LookinIvarTrace.js";
export { type LookinObject, decodeLookinObject } from "./LookinObject.js";
export { type LookinAttribute, decodeLookinAttribute } from "./LookinAttribute.js";
export { type LookinAttributesSection, decodeLookinAttributesSection } from "./LookinAttributesSection.js";
export { type LookinAttributesGroup, decodeLookinAttributesGroup } from "./LookinAttributesGroup.js";
export { type LookinEventHandler, decodeLookinEventHandler } from "./LookinEventHandler.js";
export { type LookinAppInfo, decodeLookinAppInfo } from "./LookinAppInfo.js";
export { type LookinDisplayItem, decodeLookinDisplayItem } from "./LookinDisplayItem.js";
export { type LookinHierarchyInfo, decodeLookinHierarchyInfo } from "./LookinHierarchyInfo.js";
export {
  type LookinConnectionAttachment,
  type LookinConnectionResponseAttachment,
  decodeLookinConnectionAttachment,
  decodeLookinConnectionResponseAttachment,
} from "./LookinConnectionResponseAttachment.js";
export { type LookinAttributeModification, decodeLookinAttributeModification } from "./LookinAttributeModification.js";
export {
  type LookinStaticAsyncUpdateTask,
  type LookinStaticAsyncUpdateTasksPackage,
  decodeLookinStaticAsyncUpdateTask,
  decodeLookinStaticAsyncUpdateTasksPackage,
} from "./LookinStaticAsyncUpdateTask.js";
export {
  type LookinTwoTuple,
  type LookinStringTwoTuple,
  decodeLookinTwoTuple,
  decodeLookinStringTwoTuple,
} from "./LookinTwoTuple.js";
export { type LookinCustomDisplayItemInfo, decodeLookinCustomDisplayItemInfo } from "./LookinCustomDisplayItemInfo.js";
export { type LookinDisplayItemDetail, decodeLookinDisplayItemDetail } from "./LookinDisplayItemDetail.js";
export { type LookinCustomAttrModification, decodeLookinCustomAttrModification } from "./LookinCustomAttrModification.js";
export { type LookinHierarchyFile, decodeLookinHierarchyFile } from "./LookinHierarchyFile.js";

// Re-export enums and helpers
export {
  LookinAttrType,
  LookinAppInfoDevice,
  LookinStaticAsyncUpdateTaskType,
  LookinDetailUpdateTaskAttrRequest,
  LookinEventHandlerType,
} from "./LookinAttrType.js";
export { type CGRect, type ImageData, parseCGRect, normalizeImage } from "./_helpers.js";
