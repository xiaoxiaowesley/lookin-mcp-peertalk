/**
 * Minimal NSKeyedArchiver bplist encoder.
 *
 * Just enough to serialise simple outbound request objects (e.g.
 * LookinAttributeModification). Supported value types:
 *
 *   • Primitives: string, number, boolean, null/undefined, Buffer (→ NSData)
 *   • Arrays                    → NSArray
 *   • Plain dictionaries        → NSDictionary
 *   • Objects with `_className` → archived as instances of that class
 *
 * Output format (consumed by Apple's NSKeyedUnarchiver and our
 * `keyed-unarchiver.ts`):
 *
 *   {
 *     "$archiver": "NSKeyedArchiver",
 *     "$version":  100000,
 *     "$top":      { "root": UID(1) },
 *     "$objects":  [ "$null", <root>, ...flat object table ]
 *   }
 */

import bplistCreator from "bplist-creator";

/**
 * Marker class for values that should be stored inline in the NSKeyedArchiver
 * dict (corresponding to encodeInteger:/encodeBool:/encodeDouble:forKey:).
 * Without this wrapper, numbers and booleans are encoded as UID references
 * (corresponding to encodeObject:forKey: with NSNumber).
 */
export class InlineScalar {
  constructor(public readonly value: number | boolean) {}
}

interface ClassDescriptor {
  $classname: string;
  $classes: string[];
}

class ArchiveBuilder {
  /** Index 0 is always "$null". */
  private objects: any[] = ["$null"];

  /** Memo for class-descriptor objects (className → UID index). */
  private classCache: Map<string, number> = new Map();

  /** Memo for primitive de-duplication (string only — common case). */
  private stringCache: Map<string, number> = new Map();

  build(root: any, rootClassName: string): Buffer {
    const rootUidIdx = this.encodeWithClass(root, rootClassName);

    const plist: any = {
      $archiver: "NSKeyedArchiver",
      $version: 100000,
      $top: { root: { UID: rootUidIdx } },
      $objects: this.objects,
    };
    return bplistCreator(plist);
  }

  // ------------------------------------------------------------
  // Encode dispatch
  // ------------------------------------------------------------

  private encode(v: any): number {
    if (v === null || v === undefined) return 0; // $null
    if (Buffer.isBuffer(v)) return this.encodeBuffer(v);
    const t = typeof v;
    if (t === "string") return this.encodeString(v);
    if (t === "number" || t === "boolean" || t === "bigint")
      return this.pushObject(v);
    if (Array.isArray(v)) return this.encodeArray(v);
    if (t === "object") {
      if (typeof v._className === "string") {
        const cls = v._className as string;
        const copy: Record<string, any> = {};
        for (const k of Object.keys(v)) {
          if (k === "_className") continue;
          copy[k] = v[k];
        }
        return this.encodeWithClass(copy, cls);
      }
      return this.encodeDictionary(v as Record<string, any>);
    }
    // Fallback — store as-is.
    return this.pushObject(v);
  }

  private encodeString(s: string): number {
    const cached = this.stringCache.get(s);
    if (cached !== undefined) return cached;
    const idx = this.pushObject(s);
    this.stringCache.set(s, idx);
    return idx;
  }

  private encodeBuffer(buf: Buffer): number {
    return this.pushObject(buf);
  }

  // ------------------------------------------------------------
  // Containers
  // ------------------------------------------------------------

  private encodeArray(arr: any[]): number {
    const placeholder: Record<string, any> = {};
    const idx = this.pushObject(placeholder);
    const childUids = arr.map((item) => ({ UID: this.encode(item) }));
    placeholder.$class = { UID: this.classRef("NSArray", ["NSArray", "NSObject"]) };
    placeholder["NS.objects"] = childUids;
    return idx;
  }

  private encodeDictionary(dict: Record<string, any>): number {
    const placeholder: Record<string, any> = {};
    const idx = this.pushObject(placeholder);
    const keys = Object.keys(dict);
    const keyUids = keys.map((k) => ({ UID: this.encodeString(k) }));
    const valUids = keys.map((k) => ({ UID: this.encode(dict[k]) }));
    placeholder.$class = {
      UID: this.classRef("NSDictionary", ["NSDictionary", "NSObject"]),
    };
    placeholder["NS.keys"] = keyUids;
    placeholder["NS.objects"] = valUids;
    return idx;
  }

  private encodeWithClass(obj: any, className: string): number {
    if (Array.isArray(obj)) {
      // class-tagged array: emit as that class with NS.objects.
      const placeholder: Record<string, any> = {};
      const idx = this.pushObject(placeholder);
      const childUids = obj.map((item) => ({ UID: this.encode(item) }));
      placeholder.$class = {
        UID: this.classRef(className, [className, "NSArray", "NSObject"]),
      };
      placeholder["NS.objects"] = childUids;
      return idx;
    }
    if (!obj || typeof obj !== "object") {
      // primitive → wrap in a singleton dict-like object.
      return this.encode(obj);
    }
    const placeholder: Record<string, any> = {};
    const idx = this.pushObject(placeholder);
    placeholder.$class = {
      UID: this.classRef(className, [className, "NSObject"]),
    };
    for (const k of Object.keys(obj)) {
      if (k === "_className") continue;
      const val = obj[k];
      if (val === null || val === undefined) {
        // encodeObject:nil — NSKeyedArchiver skips nil values, not written to dict
        continue;
      }
      if (val instanceof InlineScalar) {
        // encodeInteger:/encodeBool:/encodeDouble:forKey: — inline scalar value
        placeholder[k] = val.value;
      } else {
        // encodeObject:forKey: — UID reference (numbers, strings, dicts, arrays, etc.)
        placeholder[k] = { UID: this.encode(val) };
      }
    }
    return idx;
  }

  // ------------------------------------------------------------
  // Class descriptor table
  // ------------------------------------------------------------

  private classRef(name: string, chain: string[]): number {
    const cached = this.classCache.get(name);
    if (cached !== undefined) return cached;
    const desc: ClassDescriptor = {
      $classname: name,
      $classes: chain,
    };
    const idx = this.pushObject(desc);
    this.classCache.set(name, idx);
    return idx;
  }

  // ------------------------------------------------------------
  // Low-level
  // ------------------------------------------------------------

  private pushObject(v: any): number {
    const idx = this.objects.length;
    this.objects.push(v);
    return idx;
  }
}

/**
 * Archive `rootObj` as an instance of `className` (which becomes its
 * `$class.$classname`). The returned Buffer is a binary plist ready to be
 * sent as a Peertalk frame payload.
 */
export function archive(rootObj: any, className: string): Buffer {
  const builder = new ArchiveBuilder();
  return builder.build(rootObj, className);
}
