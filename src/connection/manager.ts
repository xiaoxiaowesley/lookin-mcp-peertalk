/**
 * ConnectionManager
 *
 * Owns a fleet of `PeertalkChannel`s (one per discovered LookinServer port)
 * and offers a request/response abstraction matching the official client
 * (`LKConnectionManager.m`):
 *
 *   • `ping(portKey)`           — protocol handshake + server-version check.
 *   • `request(portKey, type)`  — wraps the payload in a
 *                                 LookinConnectionAttachment, dedupes against
 *                                 prior in-flight requests of the same type,
 *                                 reassembles multi-frame responses, and
 *                                 enforces a per-frame timeout.
 *
 * Channel lifecycle (add/remove) is driven externally — `port-scanner.ts`
 * produces sockets, the caller wraps each in a `PeertalkChannel`, then
 * registers it via `addChannel()`.
 *
 * Wire layout reminder: every request/response payload is a binary plist
 * produced by NSKeyedArchiver. Outgoing payloads are
 * `LookinConnectionAttachment`; incoming payloads are
 * `LookinConnectionResponseAttachment` (subclass with version, totalCount,
 * currentCount, error fields).
 */

import { PeertalkChannel } from "../peertalk/channel.js";
import {
  LookinRequestType,
  LookinPushType,
  LookinErrCode,
  LOOKIN_SUPPORTED_SERVER_MIN,
  LOOKIN_SUPPORTED_SERVER_MAX,
} from "../peertalk/frame-types.js";
import { unarchive } from "../peertalk/keyed-unarchiver.js";
import { archive, InlineScalar } from "../peertalk/keyed-archiver.js";
import "../peertalk/schemas/index.js"; // side-effect: registers all Lookin* decoders
import type { LookinConnectionResponseAttachment } from "../peertalk/schemas/LookinConnectionResponseAttachment.js";

// ────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────

export interface ConnectionManagerOptions {
  /** Ping timeout in ms (default 500). */
  pingTimeoutMs?: number;
  /** Per-frame request timeout in ms (default 5000). Reset on every frame. */
  requestTimeoutMs?: number;
}

export interface PushEvent {
  portKey: string;
  type: LookinPushType | number;
  data: any;
}

export type PushListener = (event: PushEvent) => void;
export type ChannelEndListener = (portKey: string) => void;

/** Error carrying a `LookinErrCode`. */
export class LookinError extends Error {
  constructor(public readonly code: LookinErrCode, message: string) {
    super(message);
    this.name = "LookinError";
  }
}

// ────────────────────────────────────────────────────────────
// Internal request bookkeeping
// ────────────────────────────────────────────────────────────

interface PendingRequest {
  type: number;
  tag: number;
  /** Accumulated decoded `data` chunks across frames. */
  chunks: any[];
  /** `dataTotalCount` reported by server (0 = single-frame). */
  totalCount: number;
  /** Sum of `currentDataCount` seen so far. */
  receivedCount: number;
  /** Per-frame timeout timer; reset on every received frame. */
  timer: NodeJS.Timeout | null;
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  /** True when resolved/rejected so late frames are ignored. */
  settled: boolean;
}

// Set of frame types treated as server pushes (no tag matching, no dedup).
const PUSH_FRAME_TYPES: ReadonlySet<number> = new Set<number>([
  LookinPushType.BringForwardScreenshotTask,
  LookinPushType.CancelHierarchyDetails,
]);

// ────────────────────────────────────────────────────────────
// ConnectionManager
// ────────────────────────────────────────────────────────────

export class ConnectionManager {
  private readonly channels: Map<string, PeertalkChannel> = new Map();
  /**
   * pending[portKey] = Map<type, PendingRequest>
   * Per official semantics, dedup happens within a (channel, type) pair.
   */
  private readonly pending: Map<string, Map<number, PendingRequest>> = new Map();
  private readonly handlers: Map<
    string,
    {
      onFrame: (type: number, tag: number, payload: Buffer) => void;
      onClose: () => void;
      onError: (err: Error) => void;
    }
  > = new Map();

  private readonly pushListeners: Set<PushListener> = new Set();
  private readonly endListeners: Set<ChannelEndListener> = new Set();

  private readonly pingTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(opts: ConnectionManagerOptions = {}) {
    this.pingTimeoutMs = opts.pingTimeoutMs ?? 500;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 5000;
  }

  // ────────────────────────────────────────────────────────
  // Channel registry
  // ────────────────────────────────────────────────────────

  /** Attach a connected `PeertalkChannel` and start dispatching its frames. */
  addChannel(portKey: string, channel: PeertalkChannel): void {
    if (this.channels.has(portKey)) {
      throw new Error(`ConnectionManager: portKey "${portKey}" already registered`);
    }
    this.channels.set(portKey, channel);
    this.pending.set(portKey, new Map());

    const onFrame = (type: number, tag: number, payload: Buffer): void => {
      this.handleFrame(portKey, type, tag, payload);
    };
    const onClose = (): void => {
      this.cleanupChannel(portKey, new LookinError(LookinErrCode.NoConnect, "Channel closed"));
      for (const l of this.endListeners) {
        try {
          l(portKey);
        } catch {
          /* listener errors are ignored */
        }
      }
    };
    const onError = (_err: Error): void => {
      // Errors usually precede a close; just log via the close path below.
    };

    channel.on("frame", onFrame);
    channel.on("close", onClose);
    channel.on("error", onError);
    this.handlers.set(portKey, { onFrame, onClose, onError });
  }

  /** Remove (and close) a channel. Idempotent. */
  removeChannel(portKey: string): void {
    const channel = this.channels.get(portKey);
    if (!channel) return;
    this.cleanupChannel(portKey, new LookinError(LookinErrCode.NoConnect, "Channel removed"));
    try {
      channel.close();
    } catch {
      /* ignore */
    }
  }

  getChannel(portKey: string): PeertalkChannel | undefined {
    return this.channels.get(portKey);
  }

  getActivePortKeys(): string[] {
    return Array.from(this.channels.keys());
  }

  /** Subscribe to incoming push frames from any channel. Returns an unsubscribe fn. */
  onPush(listener: PushListener): () => void {
    this.pushListeners.add(listener);
    return () => this.pushListeners.delete(listener);
  }

  /** Subscribe to channel-end events. Returns an unsubscribe fn. */
  onChannelEnd(listener: ChannelEndListener): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  /** Close all channels. */
  closeAll(): void {
    for (const portKey of Array.from(this.channels.keys())) {
      this.removeChannel(portKey);
    }
  }

  // ────────────────────────────────────────────────────────
  // Ping / version handshake
  // ────────────────────────────────────────────────────────

  /**
   * Send a Ping request, decode the response attachment, and verify the
   * `lookinServerVersion` falls within the supported range.
   *
   * @returns The full `LookinConnectionResponseAttachment`.
   * @throws  `LookinError` on timeout, server error, version mismatch, or
   *          background app state.
   */
  async ping(portKey: string): Promise<LookinConnectionResponseAttachment> {
    const channel = this.channels.get(portKey);
    if (!channel) {
      throw new LookinError(LookinErrCode.NoConnect, `No channel for portKey "${portKey}"`);
    }

    const attachment = await this.sendAndAwait<LookinConnectionResponseAttachment>(
      portKey,
      LookinRequestType.Ping,
      null,
      this.pingTimeoutMs,
      /* returnAttachment */ true
    );

    // Background-state check (mirrors LKConnectionManager.m).
    if (attachment.appIsInBackground) {
      throw new LookinError(
        LookinErrCode.PingFailForBackgroundState,
        "App reported background state during Ping"
      );
    }

    const v = attachment.lookinServerVersion;
    if (v === -1 || v === 100) {
      throw new LookinError(
        LookinErrCode.ServerVersionTooLow,
        `LookinServer version ${v} is too low — please update LookinServer.framework.`
      );
    }
    if (v > LOOKIN_SUPPORTED_SERVER_MAX) {
      throw new LookinError(
        LookinErrCode.ServerVersionTooHigh,
        `LookinServer version ${v} is too high — please update the Lookin client (max supported: ${LOOKIN_SUPPORTED_SERVER_MAX}).`
      );
    }
    if (v < LOOKIN_SUPPORTED_SERVER_MIN) {
      throw new LookinError(
        LookinErrCode.ServerVersionTooLow,
        `LookinServer version ${v} is too low (min supported: ${LOOKIN_SUPPORTED_SERVER_MIN}).`
      );
    }

    return attachment;
  }

  // ────────────────────────────────────────────────────────
  // Request / response
  // ────────────────────────────────────────────────────────

  /**
   * Send a typed request and wait for its (possibly multi-frame) response.
   *
   * - Outgoing payload is wrapped in a `LookinConnectionAttachment`.
   * - If a prior in-flight request of the same `type` exists on this channel,
   *   it is rejected with `LookinErrCode.Discard` (mirrors the official client).
   * - Multi-frame responses are reassembled via `dataTotalCount` /
   *   `currentDataCount`. Per-frame timeout resets on every frame.
   *
   * @returns For single-frame responses, the unwrapped `attachment.data`
   *          (typically a decoded business object). For multi-frame
   *          responses, an array of per-frame `data` chunks (caller may
   *          flatten if needed).
   */
  async request(
    portKey: string,
    type: LookinRequestType | number,
    payload?: any
  ): Promise<any> {
    const channel = this.channels.get(portKey);
    if (!channel) {
      throw new LookinError(LookinErrCode.NoConnect, `No channel for portKey "${portKey}"`);
    }
    return this.sendAndAwait<any>(
      portKey,
      type,
      payload ?? null,
      this.requestTimeoutMs,
      /* returnAttachment */ false
    );
  }

  /**
   * Fire-and-forget push to the server. Mirrors official client's
   * `pushWithType:data:channel:`. The server is not expected to reply.
   */
  push(portKey: string, type: LookinPushType | number, payload?: any): void {
    const channel = this.channels.get(portKey);
    if (!channel) {
      throw new LookinError(LookinErrCode.NoConnect, `No channel for portKey "${portKey}"`);
    }
    const body = encodeAttachment(payload ?? null);
    channel.sendFrame(type, body, 0);
  }

  // ────────────────────────────────────────────────────────
  // Internal: request lifecycle
  // ────────────────────────────────────────────────────────

  private sendAndAwait<T>(
    portKey: string,
    type: number,
    payload: any,
    timeoutMs: number,
    returnAttachment: boolean
  ): Promise<T> {
    const channel = this.channels.get(portKey);
    if (!channel) {
      return Promise.reject(
        new LookinError(LookinErrCode.NoConnect, `No channel for portKey "${portKey}"`)
      );
    }

    // Discard any prior in-flight request of the same (portKey, type), except
    // for Ping itself (the official client allows concurrent pings).
    if (type !== LookinRequestType.Ping) {
      this.discardPending(portKey, type);
    }

    return new Promise<T>((resolve, reject) => {
      let body: Buffer;
      let tag: number;
      try {
        body = encodeAttachment(payload);
        // Tag = unix timestamp seconds, like the official client.
        tag = Math.floor(Date.now() / 1000) >>> 0;
        channel.sendFrame(type, body, tag);
      } catch (e) {
        reject(
          new LookinError(
            LookinErrCode.PeerTalk,
            `Failed to send frame: ${e instanceof Error ? e.message : String(e)}`
          )
        );
        return;
      }

      const req: PendingRequest = {
        type,
        tag,
        chunks: [],
        totalCount: 0,
        receivedCount: 0,
        timer: null,
        settled: false,
        resolve: (value: any) => {
          if (returnAttachment) {
            resolve(value as T);
          } else {
            // Single-frame: return the unwrapped data; multi-frame: return chunk array.
            const isMulti = req.totalCount > 0;
            if (isMulti) {
              resolve(req.chunks as unknown as T);
            } else {
              const attachment = value as LookinConnectionResponseAttachment;
              resolve(attachment.data as T);
            }
          }
        },
        reject,
      };

      const portMap = this.pending.get(portKey);
      if (portMap) portMap.set(type, req);
      this.armTimer(portKey, req, timeoutMs);
    });
  }

  /** Reject and remove any pending request matching (portKey, type). */
  private discardPending(portKey: string, type: number): void {
    const portMap = this.pending.get(portKey);
    if (!portMap) return;
    const old = portMap.get(type);
    if (!old) return;
    portMap.delete(type);
    if (old.timer) {
      clearTimeout(old.timer);
      old.timer = null;
    }
    if (!old.settled) {
      old.settled = true;
      old.reject(
        new LookinError(LookinErrCode.Discard, "Request discarded by a newer same-type request")
      );
    }
  }

  private armTimer(portKey: string, req: PendingRequest, timeoutMs: number): void {
    if (req.timer) clearTimeout(req.timer);
    req.timer = setTimeout(() => {
      const portMap = this.pending.get(portKey);
      if (portMap) portMap.delete(req.type);
      if (!req.settled) {
        req.settled = true;
        req.reject(new LookinError(LookinErrCode.Timeout, "Request timed out"));
      }
    }, timeoutMs);
  }

  private resolvePending(
    portKey: string,
    req: PendingRequest,
    attachment: LookinConnectionResponseAttachment
  ): void {
    const portMap = this.pending.get(portKey);
    if (portMap) portMap.delete(req.type);
    if (req.timer) {
      clearTimeout(req.timer);
      req.timer = null;
    }
    if (!req.settled) {
      req.settled = true;
      req.resolve(attachment);
    }
  }

  private rejectPending(portKey: string, req: PendingRequest, err: Error): void {
    const portMap = this.pending.get(portKey);
    if (portMap) portMap.delete(req.type);
    if (req.timer) {
      clearTimeout(req.timer);
      req.timer = null;
    }
    if (!req.settled) {
      req.settled = true;
      req.reject(err);
    }
  }

  // ────────────────────────────────────────────────────────
  // Internal: incoming frames
  // ────────────────────────────────────────────────────────

  private handleFrame(
    portKey: string,
    type: number,
    tag: number,
    payload: Buffer
  ): void {
    if (PUSH_FRAME_TYPES.has(type)) {
      let data: any = null;
      if (payload.length > 0) {
        try {
          data = unarchive(payload);
        } catch {
          /* push frames may be empty/non-archive */
        }
      }
      const event: PushEvent = { portKey, type, data };
      for (const l of this.pushListeners) {
        try {
          l(event);
        } catch {
          /* listener errors are ignored */
        }
      }
      return;
    }

    const portMap = this.pending.get(portKey);
    const req = portMap?.get(type);
    if (!req || req.tag !== tag) {
      // Stray frame — request has already been completed/discarded.
      return;
    }

    let attachment: LookinConnectionResponseAttachment;
    try {
      attachment = unarchive(payload) as LookinConnectionResponseAttachment;
    } catch (e) {
      this.rejectPending(
        portKey,
        req,
        new LookinError(
          LookinErrCode.Inner,
          `Failed to decode response: ${e instanceof Error ? e.message : String(e)}`
        )
      );
      return;
    }

    if (!attachment || typeof attachment !== "object") {
      this.rejectPending(
        portKey,
        req,
        new LookinError(LookinErrCode.Inner, "Decoded response is not an object")
      );
      return;
    }

    // Background state aborts all non-Ping requests too (matches official client).
    if (attachment.appIsInBackground) {
      this.rejectPending(
        portKey,
        req,
        new LookinError(
          LookinErrCode.PingFailForBackgroundState,
          "App reported background state"
        )
      );
      return;
    }

    if (attachment.error) {
      this.rejectPending(
        portKey,
        req,
        new LookinError(
          LookinErrCode.Default,
          `Server returned error: ${stringifyError(attachment.error)}`
        )
      );
      return;
    }

    // Aggregation bookkeeping.
    req.chunks.push(attachment.data);
    if (attachment.dataTotalCount > 0) {
      req.totalCount = attachment.dataTotalCount;
      req.receivedCount += attachment.currentDataCount || 0;
      const done = req.receivedCount >= attachment.dataTotalCount;
      if (done) {
        this.resolvePending(portKey, req, attachment);
      } else {
        // More frames pending — reset the per-frame deadline.
        this.armTimer(portKey, req, this.requestTimeoutMs);
      }
    } else {
      // Single-frame response.
      this.resolvePending(portKey, req, attachment);
    }
  }

  // ────────────────────────────────────────────────────────
  // Internal: cleanup
  // ────────────────────────────────────────────────────────

  private cleanupChannel(portKey: string, reason: Error): void {
    const channel = this.channels.get(portKey);
    if (!channel) return;
    const handlers = this.handlers.get(portKey);
    if (handlers) {
      channel.off("frame", handlers.onFrame);
      channel.off("close", handlers.onClose);
      channel.off("error", handlers.onError);
    }
    this.handlers.delete(portKey);
    this.channels.delete(portKey);

    const portMap = this.pending.get(portKey);
    if (portMap) {
      for (const req of portMap.values()) {
        if (req.timer) clearTimeout(req.timer);
        if (!req.settled) {
          req.settled = true;
          req.reject(reason);
        }
      }
      portMap.clear();
    }
    this.pending.delete(portKey);
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Wrap `data` in a `LookinConnectionAttachment` and archive it as a binary
 * plist. NSCoding keys are `"0"` (data) and `"1"` (dataType).
 */
function encodeAttachment(data: any): Buffer {
  const root: Record<string, any> = {
    "0": data,                        // encodeObject:forKey: — UID ref (null → skipped)
    "1": new InlineScalar(0),         // encodeInteger:forKey: — inline
  };
  return archive(root, "LookinConnectionAttachment");
}

function stringifyError(err: any): string {
  if (!err) return "<nil>";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const desc = err.NSLocalizedDescription ?? err.description ?? err.message;
    if (typeof desc === "string") return desc;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
