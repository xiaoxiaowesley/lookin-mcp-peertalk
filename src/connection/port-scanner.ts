/**
 * Port scanner — concurrently probe a port range for live LookinServer endpoints.
 *
 * Simulator side: probe 127.0.0.1:47164–47169 directly with TCP.
 * USB side:       probe device:47175–47179 by opening a usbmuxd tunnel per port.
 *
 * Successful sockets are returned to the caller, which is responsible for
 * wiring them into a `PeertalkChannel`. Failed probes are silently dropped.
 */

import * as net from "net";
import {
  SIM_PORT_START,
  SIM_PORT_END,
  USB_PORT_START,
  USB_PORT_END,
} from "../peertalk/frame-types.js";
import { connectToDevice } from "../usbmuxd.js";

export interface ScannedPort {
  port: number;
  socket: net.Socket;
  type: "simulator" | "usb";
  /** Only set for USB scans — the usbmuxd-assigned device ID. */
  deviceId?: number;
}

const DEFAULT_TIMEOUT_MS = 500;

// ────────────────────────────────────────────────────────────
// TCP probing (simulator)
// ────────────────────────────────────────────────────────────

function tryConnectTcp(
  host: string,
  port: number,
  timeoutMs: number
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(`TCP connect timeout for ${host}:${port}`));
    }, timeoutMs);

    socket.once("connect", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

/**
 * Concurrently probe every port in [portStart, portEnd] on the given host.
 * Failed probes are silently ignored. Returns only successful sockets.
 */
export async function scanPorts(
  host: string,
  portStart: number,
  portEnd: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ScannedPort[]> {
  const ports: number[] = [];
  for (let p = portStart; p <= portEnd; p++) ports.push(p);

  const tasks = ports.map((port) =>
    tryConnectTcp(host, port, timeoutMs)
      .then<ScannedPort>((socket) => ({ port, socket, type: "simulator" }))
      .catch(() => null)
  );

  const settled = await Promise.allSettled(tasks);
  const out: ScannedPort[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
}

/** Scan the simulator port range on 127.0.0.1. */
export async function scanSimulatorPorts(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ScannedPort[]> {
  return scanPorts("127.0.0.1", SIM_PORT_START, SIM_PORT_END, timeoutMs);
}

// ────────────────────────────────────────────────────────────
// USB probing (via usbmuxd tunnel)
// ────────────────────────────────────────────────────────────

function tryUsbConnect(
  deviceId: number,
  port: number,
  timeoutMs: number
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`USB connect timeout for device ${deviceId}:${port}`));
    }, timeoutMs);

    connectToDevice(deviceId, port)
      .then((socket) => {
        if (settled) {
          // We already gave up; tear down the tunnel.
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(socket);
      })
      .catch((err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Scan a single USB device's port range by opening usbmuxd tunnels.
 * Each successful probe yields a tunnel socket that can be passed to PeertalkChannel.
 */
export async function scanUsbPorts(
  deviceId: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ScannedPort[]> {
  const ports: number[] = [];
  for (let p = USB_PORT_START; p <= USB_PORT_END; p++) ports.push(p);

  const tasks = ports.map((port) =>
    tryUsbConnect(deviceId, port, timeoutMs)
      .then<ScannedPort>((socket) => ({
        port,
        socket,
        type: "usb",
        deviceId,
      }))
      .catch(() => null)
  );

  const settled = await Promise.allSettled(tasks);
  const out: ScannedPort[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
}
