// Lookin protocol version constants
export const LOOKIN_CLIENT_VERSION = 7;
export const LOOKIN_SUPPORTED_SERVER_MIN = 7;
export const LOOKIN_SUPPORTED_SERVER_MAX = 7;

// Port ranges
export const SIM_PORT_START = 47164;
export const SIM_PORT_END = 47169;
export const USB_PORT_START = 47175;
export const USB_PORT_END = 47179;

// Peertalk frame constants
export const PT_FRAME_VERSION = 1;
export const PT_FRAME_HEADER_SIZE = 16;
export const PT_FRAME_NO_TAG = 0;
export const PT_FRAME_TYPE_END_OF_STREAM = 0;

// Request types
export enum LookinRequestType {
  Ping = 200,
  App = 201,
  Hierarchy = 202,
  HierarchyDetails = 203,
  InbuiltAttrModification = 204,
  AttrModificationPatch = 205,
  InvokeMethod = 206,
  FetchObject = 207,
  FetchImageViewImage = 208,
  ModifyRecognizerEnable = 209,
  AllAttrGroups = 210,
  AllSelectorNames = 213,
  CustomAttrModification = 214,
}

// Push types (server → client)
export enum LookinPushType {
  BringForwardScreenshotTask = 303,
  CancelHierarchyDetails = 304,
}

// Error codes
export enum LookinErrCode {
  Default = -400,
  Inner = -401,
  PeerTalk = -402,
  NoConnect = -403,
  PingFailForTimeout = -404,
  Timeout = -405,
  Discard = -406,
  PingFailForBackgroundState = -407,
  ObjectNotFound = -500,
  ServerVersionTooHigh = -600,
  ServerVersionTooLow = -601,
}
