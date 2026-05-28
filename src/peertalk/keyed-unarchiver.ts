/**
 * NSKeyedArchiver bplist unarchiver.
 *
 * Decodes binary plists produced by Apple's NSKeyedArchiver into plain
 * JavaScript values, with a pluggable class registry so business types
 * (LookinDisplayItem, LookinHierarchyInfo, ...) can install custom decoders
 * later (Task 3 schema layer).
 *
 * Top-level archive shape:
 *   {
 *     "$archiver": "NSKeyedArchiver",
 *     "$version": 100000,
 *     "$top":     { "root": UID(n) },
 *     "$objects": [ "$null", ...flat object table ]
 *   }
 *
 * UID values from bplist-parser arrive as `{ UID: number }` (or the parser's
 * UID class instance whose `.UID` is the index into `$objects`).
 */

import bplistParser from "bplist-parser";

// ────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────

export interface UnarchiverContext {
  /** Decode a UID reference (or pass-through primitives) recursively. */
  decodeObject(uid: any): any;
  /** Original `$objects` flat array (rarely needed by decoders). */
  objects: any[];
}

export type ClassDecoder = (
  keys: Record<string, any>,
  ctx: UnarchiverContext
) => any;

// ────────────────────────────────────────────────────────────
// Class registry
// ────────────────────────────────────────────────────────────

const registry: Map<string, ClassDecoder> = new Map();

export function registerClass(className: string, decoder: ClassDecoder): void {
  registry.set(className, decoder);
}

export function hasRegisteredClass(className: string): boolean {
  return registry.has(className);
}

// ────────────────────────────────────────────────────────────
// UID helper
// ────────────────────────────────────────────────────────────

function isUID(v: any): v is { UID: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as any).UID === "number" &&
    Number.isFinite((v as any).UID)
  );
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export function unarchive(buffer: Buffer): any {
  const parsed = bplistParser.parseBuffer(buffer);
  const root: any = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!root || typeof root !== "object") {
    throw new Error("unarchive: bplist root is not an object");
  }
  if (root.$archiver !== "NSKeyedArchiver") {
    throw new Error(
      `unarchive: $archiver is "${root.$archiver}", expected "NSKeyedArchiver"`
    );
  }

  const objects: any[] = root.$objects;
  if (!Array.isArray(objects)) {
    throw new Error("unarchive: $objects is missing or not an array");
  }

  const top = root.$top;
  if (!top || typeof top !== "object") {
    throw new Error("unarchive: $top is missing or not an object");
  }
  // Most archives use { root: UID }, but pick the first key as a fallback.
  const rootRef = "root" in top ? top.root : top[Object.keys(top)[0]];

  const decoder = new Decoder(objects);
  return decoder.decode(rootRef);
}

// ────────────────────────────────────────────────────────────
// Internal decoder
// ────────────────────────────────────────────────────────────

class Decoder implements UnarchiverContext {
  readonly objects: any[];
  private cache: Map<number, any> = new Map();

  constructor(objects: any[]) {
    this.objects = objects;
  }

  decodeObject = (v: any): any => this.decode(v);

  /**
   * Decode a value (UID reference, inline array, inline dict, or primitive).
   *
   * `$objects` table entries can themselves contain inline arrays or dicts
   * (e.g. NSDictionary's `NS.keys` field is an inline array of UIDs).
   * Those inline structures don't have a stable `$objects` index of their
   * own, so they bypass the cycle-detection cache but still need their
   * UID children recursed.
   */
  decode(v: any): any {
    if (isUID(v)) return this.decodeUidRef(v.UID);
    if (Array.isArray(v)) return v.map((item) => this.decode(item));
    if (v && typeof v === "object" && !Buffer.isBuffer(v)) {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v)) out[k] = this.decode(v[k]);
      return out;
    }
    return this.decodePrimitive(v);
  }

  private decodeUidRef(idx: number): any {
    if (this.cache.has(idx)) {
      return this.cache.get(idx);
    }
    if (idx < 0 || idx >= this.objects.length) {
      return null;
    }
    const raw = this.objects[idx];

    // $null sentinel
    if (raw === "$null") {
      this.cache.set(idx, null);
      return null;
    }

    // Primitives — cache & return directly.
    if (raw === null || typeof raw !== "object") {
      const prim = this.decodePrimitive(raw);
      this.cache.set(idx, prim);
      return prim;
    }
    if (Buffer.isBuffer(raw)) {
      this.cache.set(idx, raw);
      return raw;
    }

    // For composite objects we put a placeholder first to break cycles.
    const placeholder: any = Array.isArray(raw) ? [] : {};
    this.cache.set(idx, placeholder);

    const result = this.decodeComposite(raw, placeholder);

    // If the decoded value differs from the placeholder identity (e.g. a
    // primitive surrogate or a brand-new object returned by a class decoder),
    // overwrite the cache so future references see the canonical value.
    if (result !== placeholder) {
      this.cache.set(idx, result);
    }
    return result;
  }

  private decodePrimitive(raw: any): any {
    if (raw === "$null") return null;
    if (raw === null || raw === undefined) return null;
    if (Buffer.isBuffer(raw)) return raw;
    const t = typeof raw;
    if (t === "string" || t === "number" || t === "boolean" || t === "bigint") {
      return raw;
    }
    return raw;
  }

  // ------------------------------------------------------------------
  // Composite ($class-bearing or array) handling
  // ------------------------------------------------------------------

  private decodeComposite(raw: any, placeholder: any): any {
    if (Array.isArray(raw)) {
      const arr = placeholder as any[];
      for (const item of raw) arr.push(this.decode(item));
      return arr;
    }

    // Object with $class
    if (raw && typeof raw === "object" && "$class" in raw) {
      return this.decodeClassObject(raw, placeholder);
    }

    // Plain dict — recursively decode every value.
    return this.decodePlainDict(raw, placeholder);
  }

  private decodePlainDict(raw: any, placeholder: any): any {
    const out = placeholder as Record<string, any>;
    for (const k of Object.keys(raw)) {
      out[k] = this.decode(raw[k]);
    }
    return out;
  }

  private resolveClassName(classRef: any): {
    primary: string | null;
    chain: string[];
  } {
    let cls: any = classRef;
    if (isUID(classRef)) {
      const idx = classRef.UID;
      cls = this.objects[idx];
    }
    if (!cls || typeof cls !== "object") return { primary: null, chain: [] };
    const primary =
      typeof cls.$classname === "string" ? cls.$classname : null;
    const chain = Array.isArray(cls.$classes)
      ? (cls.$classes as any[]).filter((s) => typeof s === "string")
      : [];
    return { primary, chain };
  }

  private lookupDecoder(primary: string | null, chain: string[]): {
    name: string;
    decoder: ClassDecoder;
  } | null {
    if (primary && registry.has(primary)) {
      return { name: primary, decoder: registry.get(primary)! };
    }
    for (const c of chain) {
      if (registry.has(c)) {
        return { name: c, decoder: registry.get(c)! };
      }
    }
    return null;
  }

  private decodeClassObject(raw: any, placeholder: any): any {
    const { primary, chain } = this.resolveClassName(raw.$class);

    // Build a key→decodedValue map of all non-meta fields. Each value is
    // recursively decoded via this.decode (handles UIDs).
    const keys: Record<string, any> = {};
    for (const k of Object.keys(raw)) {
      if (k === "$class") continue;
      keys[k] = this.decode(raw[k]);
    }

    const found = this.lookupDecoder(primary, chain);
    if (found) {
      const value = found.decoder(keys, this);
      // Mirror onto placeholder if it's a plain object so existing references
      // (cycle protection) see the populated state. If the decoder returned a
      // brand-new value, the cache update in decode() picks it up.
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !Buffer.isBuffer(value) &&
        placeholder &&
        typeof placeholder === "object" &&
        !Array.isArray(placeholder) &&
        value !== placeholder
      ) {
        Object.assign(placeholder, value);
        return placeholder;
      }
      return value;
    }

    // Unknown class → return a raw dict with metadata.
    const out = placeholder as Record<string, any>;
    Object.assign(out, keys);
    if (primary) out._className = primary;
    return out;
  }
}

// ────────────────────────────────────────────────────────────
// Built-in decoders
// ────────────────────────────────────────────────────────────

// NSString / NSMutableString — value lives in NS.string
const decodeNSString: ClassDecoder = (keys) => {
  const v = keys["NS.string"];
  return typeof v === "string" ? v : v == null ? "" : String(v);
};
registerClass("NSString", decodeNSString);
registerClass("NSMutableString", decodeNSString);

// NSNumber / NSDecimalNumber — int/float/double variants
const decodeNSNumber: ClassDecoder = (keys) => {
  if ("NS.intval" in keys) return keys["NS.intval"];
  if ("NS.dblval" in keys) return keys["NS.dblval"];
  if ("NS.floatval" in keys) return keys["NS.floatval"];
  if ("NS.boolval" in keys) return keys["NS.boolval"];
  // Fallbacks observed in practice.
  if ("NS.number" in keys) return keys["NS.number"];
  return null;
};
registerClass("NSNumber", decodeNSNumber);
registerClass("NSDecimalNumber", decodeNSNumber);

// NSArray / NSMutableArray — already decoded child UIDs in NS.objects
const decodeNSArray: ClassDecoder = (keys) => {
  const arr = keys["NS.objects"];
  return Array.isArray(arr) ? arr : [];
};
registerClass("NSArray", decodeNSArray);
registerClass("NSMutableArray", decodeNSArray);

// NSSet / NSMutableSet — represented as JS array (Set semantics not preserved)
registerClass("NSSet", decodeNSArray);
registerClass("NSMutableSet", decodeNSArray);
registerClass("NSOrderedSet", decodeNSArray);

// NSDictionary / NSMutableDictionary — pair keys/values
const decodeNSDictionary: ClassDecoder = (keys) => {
  const ks = keys["NS.keys"];
  const vs = keys["NS.objects"];
  const out: Record<string, any> = {};
  if (Array.isArray(ks) && Array.isArray(vs)) {
    const n = Math.min(ks.length, vs.length);
    for (let i = 0; i < n; i++) {
      const k = ks[i];
      const key = typeof k === "string" ? k : String(k);
      out[key] = vs[i];
    }
  }
  return out;
};
registerClass("NSDictionary", decodeNSDictionary);
registerClass("NSMutableDictionary", decodeNSDictionary);

// NSData / NSMutableData
const decodeNSData: ClassDecoder = (keys) => {
  const d = keys["NS.data"];
  if (Buffer.isBuffer(d)) return d;
  if (d && typeof d === "object" && d.type === "Buffer" && Array.isArray(d.data)) {
    return Buffer.from(d.data);
  }
  return Buffer.alloc(0);
};
registerClass("NSData", decodeNSData);
registerClass("NSMutableData", decodeNSData);

// NSNull
registerClass("NSNull", () => null);

// NSDate — bplist-parser hands these back as JS Date already; mirror that.
registerClass("NSDate", (keys) => {
  if ("NS.time" in keys) {
    // Cocoa epoch (2001-01-01) seconds → ms since 1970
    const t = keys["NS.time"];
    if (typeof t === "number") return new Date(978307200000 + t * 1000);
  }
  return null;
});

// NSURL
registerClass("NSURL", (keys) => {
  const rel = keys["NS.relative"];
  const base = keys["NS.base"];
  if (typeof rel === "string" && rel.length > 0) {
    if (typeof base === "string" && base.length > 0) {
      return base.replace(/\/+$/, "") + "/" + rel.replace(/^\/+/, "");
    }
    return rel;
  }
  if (typeof base === "string") return base;
  return null;
});

// NSValue — geometry types (CGRect/CGPoint/CGSize/UIEdgeInsets)
function readDoublesLE(buf: Buffer, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.length < (i + 1) * 8) break;
    out.push(buf.readDoubleLE(i * 8));
  }
  return out;
}

function readDoublesBE(buf: Buffer, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.length < (i + 1) * 8) break;
    out.push(buf.readDoubleBE(i * 8));
  }
  return out;
}

function readDoubles(buf: Buffer, count: number): number[] {
  // Cocoa stores native LE on iOS/macOS. Try LE first; if any value looks
  // pathological we fall back to BE.
  const le = readDoublesLE(buf, count);
  const ok = le.every((n) => Number.isFinite(n) && Math.abs(n) < 1e15);
  return ok ? le : readDoublesBE(buf, count);
}

function tupleToFields(arr: number[], type: string): any {
  const t = (type || "").replace(/\s+/g, "");
  if (t.includes("CGRect") || arr.length === 4) {
    if (t.includes("UIEdgeInsets")) {
      return { top: arr[0], left: arr[1], bottom: arr[2], right: arr[3] };
    }
    return { x: arr[0], y: arr[1], width: arr[2], height: arr[3] };
  }
  if (t.includes("CGPoint") || arr.length === 2) {
    if (t.includes("CGSize")) return { width: arr[0], height: arr[1] };
    return { x: arr[0], y: arr[1] };
  }
  if (t.includes("CGSize")) return { width: arr[0], height: arr[1] };
  return arr;
}

const decodeNSValue: ClassDecoder = (keys) => {
  // Direct typed fields (some archives contain these).
  if ("NS.rectval" in keys) {
    const r = keys["NS.rectval"];
    if (Array.isArray(r) && r.length >= 4) {
      return { x: r[0], y: r[1], width: r[2], height: r[3] };
    }
  }
  if ("NS.pointval" in keys) {
    const p = keys["NS.pointval"];
    if (Array.isArray(p) && p.length >= 2) return { x: p[0], y: p[1] };
  }
  if ("NS.sizeval" in keys) {
    const s = keys["NS.sizeval"];
    if (Array.isArray(s) && s.length >= 2)
      return { width: s[0], height: s[1] };
  }
  if ("NS.edgeval" in keys) {
    const e = keys["NS.edgeval"];
    if (Array.isArray(e) && e.length >= 4) {
      return { top: e[0], left: e[1], bottom: e[2], right: e[3] };
    }
  }

  // Generic NS.value (Buffer) + NS.type (@encode string)
  const typeStr: string = typeof keys["NS.type"] === "string" ? keys["NS.type"] : "";
  const valueBuf: any = keys["NS.value"];
  if (Buffer.isBuffer(valueBuf)) {
    const t = typeStr.replace(/\s+/g, "");
    if (t.includes("CGRect") || t.includes("UIEdgeInsets")) {
      return tupleToFields(readDoubles(valueBuf, 4), t);
    }
    if (t.includes("CGPoint") || t.includes("CGSize")) {
      return tupleToFields(readDoubles(valueBuf, 2), t);
    }
    // Best-effort: try 4 doubles, then 2.
    if (valueBuf.length >= 32) return tupleToFields(readDoubles(valueBuf, 4), t);
    if (valueBuf.length >= 16) return tupleToFields(readDoubles(valueBuf, 2), t);
    return valueBuf;
  }

  // Special form: NS.special carries an integer type tag along with
  // NS.rectval-equivalent inline arrays — we already handled the typed fields
  // above, so just surface remaining keys.
  return { ...keys, _className: "NSValue" };
};
registerClass("NSValue", decodeNSValue);

// UIColor — multiple archive variants exist; cover the common ones.
const decodeUIColor: ClassDecoder = (keys) => {
  // Variant A: explicit float components.
  if ("UIRed" in keys || "UIGreen" in keys || "UIBlue" in keys || "UIAlpha" in keys) {
    return {
      red: typeof keys.UIRed === "number" ? keys.UIRed : 0,
      green: typeof keys.UIGreen === "number" ? keys.UIGreen : 0,
      blue: typeof keys.UIBlue === "number" ? keys.UIBlue : 0,
      alpha: typeof keys.UIAlpha === "number" ? keys.UIAlpha : 1,
    };
  }
  // Variant B: NSWhite + NSAlpha (gray scale)
  if ("NSWhite" in keys) {
    const w =
      Buffer.isBuffer(keys.NSWhite)
        ? parseFloat(keys.NSWhite.toString("utf8"))
        : Number(keys.NSWhite);
    const a =
      Buffer.isBuffer(keys.NSAlpha)
        ? parseFloat(keys.NSAlpha.toString("utf8"))
        : typeof keys.NSAlpha === "number"
        ? keys.NSAlpha
        : 1;
    return { red: w, green: w, blue: w, alpha: a };
  }
  // Variant C: NSRGB (NSData "r g b" string)
  if ("NSRGB" in keys && Buffer.isBuffer(keys.NSRGB)) {
    const text = keys.NSRGB.toString("utf8").trim();
    const parts = text.split(/\s+/).map((s) => parseFloat(s));
    if (parts.length >= 3) {
      return {
        red: parts[0],
        green: parts[1],
        blue: parts[2],
        alpha: parts.length >= 4 ? parts[3] : 1,
      };
    }
  }
  // Variant D: UIColorComponents (NSData of 4 floats)
  if (Buffer.isBuffer(keys.UIColorComponents)) {
    const buf: Buffer = keys.UIColorComponents;
    if (buf.length >= 16) {
      return {
        red: buf.readFloatLE(0),
        green: buf.readFloatLE(4),
        blue: buf.readFloatLE(8),
        alpha: buf.readFloatLE(12),
      };
    }
  }
  return { ...keys, _className: "UIColor" };
};
registerClass("UIColor", decodeUIColor);
registerClass("NSColor", decodeUIColor);

// UIImage — surface the underlying PNG/JPEG bytes.
function detectImageFormat(buf: Buffer): "png" | "jpeg" | "unknown" {
  if (buf.length >= 4) {
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return "png";
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "jpeg";
    }
  }
  return "unknown";
}

const decodeUIImage: ClassDecoder = (keys, ctx) => {
  let data: Buffer | null = null;

  const candidates = [
    keys["UIImagePNGRepresentation"],
    keys["UIImageJPEGRepresentation"],
    keys["UIImageData"],
    keys["NS.data"],
    keys["UIImage.imageSerialization"],
  ];
  for (const c of candidates) {
    if (Buffer.isBuffer(c)) {
      data = c;
      break;
    }
    if (c && typeof c === "object" && Buffer.isBuffer((c as any).imageData)) {
      data = (c as any).imageData;
      break;
    }
  }

  if (!data) {
    // Sometimes UIImage wraps another archive — recurse if we got a UID-ish ref
    const inner = keys["UIImageData"] ?? keys["NS.data"];
    if (inner && typeof inner === "object" && Buffer.isBuffer(inner)) data = inner;
  }

  if (data) {
    return { imageData: data, format: detectImageFormat(data) };
  }
  return { ...keys, _className: "UIImage" };
};
registerClass("UIImage", decodeUIImage);
