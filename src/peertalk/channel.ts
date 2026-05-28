/**
 * PeertalkChannel — wraps a TCP/usbmuxd socket and provides Peertalk frame I/O.
 *
 * Frame layout (16-byte header, all Big-Endian):
 *   [0-3]   version      UInt32BE = PT_FRAME_VERSION (1)
 *   [4-7]   type         UInt32BE (LookinRequestType / LookinPushType)
 *   [8-11]  tag          UInt32BE (request identifier; 0 = no-tag/push)
 *   [12-15] payloadSize  UInt32BE
 *   [16..]  payload      raw bytes (length = payloadSize)
 *
 * Reassembly uses a state machine over an internal accumulator buffer to
 * correctly handle TCP packet boundaries (one chunk may carry partial frame,
 * a single frame, or multiple frames).
 */

import type * as net from "net";
import { EventEmitter } from "events";
import {
  PT_FRAME_VERSION,
  PT_FRAME_HEADER_SIZE,
} from "./frame-types.js";

enum ParseState {
  WAITING_HEADER = 0,
  WAITING_PAYLOAD = 1,
}

export interface PeertalkChannelEvents {
  frame: (type: number, tag: number, payload: Buffer) => void;
  error: (err: Error) => void;
  close: () => void;
}

export declare interface PeertalkChannel {
  on<K extends keyof PeertalkChannelEvents>(event: K, listener: PeertalkChannelEvents[K]): this;
  off<K extends keyof PeertalkChannelEvents>(event: K, listener: PeertalkChannelEvents[K]): this;
  once<K extends keyof PeertalkChannelEvents>(event: K, listener: PeertalkChannelEvents[K]): this;
  emit<K extends keyof PeertalkChannelEvents>(event: K, ...args: Parameters<PeertalkChannelEvents[K]>): boolean;
}

export class PeertalkChannel extends EventEmitter {
  private socket: net.Socket | null = null;

  /** Accumulator for incoming bytes across data events. */
  private accum: Buffer = Buffer.alloc(0);

  /** Current parse state. */
  private state: ParseState = ParseState.WAITING_HEADER;

  /** Pending frame header info (valid in WAITING_PAYLOAD). */
  private pendingType = 0;
  private pendingTag = 0;
  private pendingPayloadSize = 0;

  /** Auto-incrementing tag for outgoing requests (starts from 1). */
  private nextTag = 1;

  /** Whether close has been emitted. */
  private closed = false;

  /**
   * Bind to a connected `net.Socket` and start consuming incoming bytes.
   * The socket should already be connected (e.g. `net.createConnection` resolved
   * or returned by `usbmuxd.connectToDevice`).
   */
  connect(socket: net.Socket): void {
    if (this.socket) {
      throw new Error("PeertalkChannel already connected");
    }
    this.socket = socket;

    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }

  /**
   * Send a frame. Returns the tag actually used.
   *
   * @param type     LookinRequestType value
   * @param payload  Optional payload buffer (defaults to empty)
   * @param tag      Optional explicit tag. If omitted, an auto-incrementing tag is used.
   */
  sendFrame(type: number, payload: Buffer = Buffer.alloc(0), tag?: number): number {
    if (!this.socket) {
      throw new Error("PeertalkChannel not connected");
    }

    const useTag = tag !== undefined ? tag : this.nextTag++;

    const header = Buffer.alloc(PT_FRAME_HEADER_SIZE);
    header.writeUInt32BE(PT_FRAME_VERSION, 0);
    header.writeUInt32BE(type >>> 0, 4);
    header.writeUInt32BE(useTag >>> 0, 8);
    header.writeUInt32BE(payload.length >>> 0, 12);

    if (payload.length > 0) {
      this.socket.write(Buffer.concat([header, payload]));
    } else {
      this.socket.write(header);
    }

    return useTag;
  }

  /** Close the underlying socket. */
  close(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // ignore
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // Internal: data parsing
  // ────────────────────────────────────────────────────────────

  private onData = (chunk: Buffer): void => {
    // Append new bytes to accumulator
    this.accum = this.accum.length === 0 ? chunk : Buffer.concat([this.accum, chunk]);

    // Drain as many complete frames as possible
    // (a single TCP read may contain partial frame, one frame, or multiple frames)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.state === ParseState.WAITING_HEADER) {
        if (this.accum.length < PT_FRAME_HEADER_SIZE) {
          return; // need more bytes
        }
        const version = this.accum.readUInt32BE(0);
        const type = this.accum.readUInt32BE(4);
        const tag = this.accum.readUInt32BE(8);
        const payloadSize = this.accum.readUInt32BE(12);

        if (version !== PT_FRAME_VERSION) {
          this.emit(
            "error",
            new Error(
              `PeertalkChannel: invalid frame version ${version}, expected ${PT_FRAME_VERSION}`
            )
          );
          this.close();
          return;
        }

        // Consume header bytes
        this.accum = this.accum.subarray(PT_FRAME_HEADER_SIZE);
        this.pendingType = type;
        this.pendingTag = tag;
        this.pendingPayloadSize = payloadSize;
        this.state = ParseState.WAITING_PAYLOAD;
        // fall-through to immediately try to consume payload
      }

      if (this.state === ParseState.WAITING_PAYLOAD) {
        if (this.accum.length < this.pendingPayloadSize) {
          return; // need more bytes
        }
        const payload =
          this.pendingPayloadSize === 0
            ? Buffer.alloc(0)
            : this.accum.subarray(0, this.pendingPayloadSize);

        // Consume payload bytes (copy out so we don't hold a reference into accum)
        const payloadCopy = Buffer.from(payload);
        this.accum = this.accum.subarray(this.pendingPayloadSize);

        const type = this.pendingType;
        const tag = this.pendingTag;

        // Reset state before emitting (in case handler calls close())
        this.state = ParseState.WAITING_HEADER;
        this.pendingType = 0;
        this.pendingTag = 0;
        this.pendingPayloadSize = 0;

        try {
          this.emit("frame", type, tag, payloadCopy);
        } catch (e) {
          this.emit("error", e instanceof Error ? e : new Error(String(e)));
        }
        // continue loop to try parsing next frame in accumulator
      }
    }
  };

  private onError = (err: Error): void => {
    this.emit("error", err);
  };

  private onClose = (): void => {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  };
}
