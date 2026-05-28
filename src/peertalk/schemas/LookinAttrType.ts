/**
 * LookinAttrType
 *
 * Mirrors `typedef NS_ENUM(NSInteger, LookinAttrType)` from
 * `LookinShared/Src/Main/Shared/LookinAttrType.h`.
 *
 * NSInteger values are sequential starting at 0. New cases may only be
 * appended at the end on the ObjC side, so numeric values are stable.
 */
export enum LookinAttrType {
  None = 0,
  Void = 1,
  Char = 2,
  Int = 3,
  Short = 4,
  Long = 5,
  LongLong = 6,
  UnsignedChar = 7,
  UnsignedInt = 8,
  UnsignedShort = 9,
  UnsignedLong = 10,
  UnsignedLongLong = 11,
  Float = 12,
  Double = 13,
  BOOL = 14,
  Sel = 15,
  Class = 16,
  CGPoint = 17,
  CGVector = 18,
  CGSize = 19,
  CGRect = 20,
  CGAffineTransform = 21,
  UIEdgeInsets = 22,
  UIOffset = 23,
  NSString = 24,
  EnumInt = 25,
  EnumLong = 26,
  /** value is RGBA components: [NSNumber, NSNumber, NSNumber, NSNumber] in 0..1 */
  UIColor = 27,
  /** parse based on attr identifier */
  CustomObj = 28,
  EnumString = 29,
  Shadow = 30,
  Json = 31,
}

/** LookinAppInfoDevice — from LookinAppInfo.h */
export enum LookinAppInfoDevice {
  Simulator = 0,
  IPad = 1,
  Others = 2,
}

/** LookinStaticAsyncUpdateTaskType — from LookinStaticAsyncUpdateTask.h */
export enum LookinStaticAsyncUpdateTaskType {
  NoScreenshot = 0,
  SoloScreenshot = 1,
  GroupScreenshot = 2,
}

/** LookinDetailUpdateTaskAttrRequest — from LookinStaticAsyncUpdateTask.h */
export enum LookinDetailUpdateTaskAttrRequest {
  Automatic = 0,
  Need = 1,
  NotNeed = 2,
}

/** LookinEventHandlerType — from LookinEventHandler.h */
export enum LookinEventHandlerType {
  TargetAction = 0,
  Gesture = 1,
}
