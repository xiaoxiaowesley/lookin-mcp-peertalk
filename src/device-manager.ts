/**
 * DeviceManager — discovery layer for Peertalk-based Lookin connections.
 *
 * Surfaces both kinds of inspection targets:
 *   • Booted iOS Simulators (queried via `xcrun simctl list devices booted`)
 *   • USB-connected physical iOS devices (queried via usbmuxd)
 *
 * For each target it can also produce a connected `net.Socket`:
 *   • Simulator → plain TCP to 127.0.0.1:<port>
 *   • USB device → usbmuxd tunnel via `connectToDevice(deviceId, port)`
 *
 * Unlike the original lookin-mcp DeviceManager there is no local TCP proxy
 * — the Peertalk pipeline consumes raw sockets directly.
 */

import * as net from "net";
import { execSync } from "child_process";
import {
  listUsbDevices,
  connectToDevice,
  watchDevices,
  type DeviceEvent,
} from "./usbmuxd.js";

export interface DeviceInfo {
  /** Device UDID (stable identifier; simulators expose this too). */
  udid: string;
  /** Human-readable name (model for simulators, UDID-as-fallback for USB). */
  name: string;
  type: "simulator" | "usb";
  /** usbmuxd-assigned device id; only present for USB devices. */
  deviceId?: number;
}

export type DeviceAttachListener = (device: DeviceInfo) => void;
export type DeviceDetachListener = (udid: string) => void;

interface BootedSimulator {
  udid: string;
  name: string;
}

export class DeviceManager {
  private stopWatchFn: (() => void) | null = null;
  /** deviceId → udid map, kept in sync by the usbmuxd watcher. */
  private readonly deviceIdToUdid: Map<number, string> = new Map();

  // ────────────────────────────────────────────────────────
  // Discovery
  // ────────────────────────────────────────────────────────

  /** List all attachable inspection targets (USB + booted simulators). */
  async listDevices(): Promise<DeviceInfo[]> {
    const [usb, sims] = await Promise.all([
      this.listUsbDevicesSafe(),
      Promise.resolve(this.listBootedSimulators()),
    ]);

    const usbInfos: DeviceInfo[] = usb.map((d) => {
      // Cache the mapping for later detach lookups.
      this.deviceIdToUdid.set(d.deviceId, d.udid);
      return {
        udid: d.udid,
        name: d.udid,
        type: "usb",
        deviceId: d.deviceId,
      };
    });

    const simInfos: DeviceInfo[] = sims.map((s) => ({
      udid: s.udid,
      name: s.name,
      type: "simulator",
    }));

    return [...simInfos, ...usbInfos];
  }

  private async listUsbDevicesSafe(): Promise<{ deviceId: number; udid: string }[]> {
    try {
      return await listUsbDevices();
    } catch {
      // usbmuxd may not be reachable (e.g. in CI / non-macOS); treat as no devices.
      return [];
    }
  }

  private listBootedSimulators(): BootedSimulator[] {
    try {
      const output = execSync("xcrun simctl list devices booted --json", {
        encoding: "utf-8",
      });
      const data = JSON.parse(output) as {
        devices: Record<string, Array<{ udid: string; name: string; state: string }>>;
      };
      const result: BootedSimulator[] = [];
      for (const list of Object.values(data.devices)) {
        for (const dev of list) {
          if (dev.state === "Booted") {
            result.push({ udid: dev.udid, name: dev.name });
          }
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  // ────────────────────────────────────────────────────────
  // Socket creation
  // ────────────────────────────────────────────────────────

  /**
   * Open a TCP connection to a simulator port on 127.0.0.1.
   * The returned socket may still be in the connecting state — listen for
   * `connect` / `error` to confirm.
   */
  createSimulatorSocket(port: number): net.Socket {
    return net.createConnection({ host: "127.0.0.1", port });
  }

  /**
   * Open a usbmuxd tunnel socket to a USB device's port.
   * Resolves once usbmuxd accepts the Connect request (port is open) or
   * rejects with a descriptive error otherwise.
   */
  async createUsbSocket(deviceId: number, port: number): Promise<net.Socket> {
    return connectToDevice(deviceId, port);
  }

  // ────────────────────────────────────────────────────────
  // Hot-plug watching
  // ────────────────────────────────────────────────────────

  /**
   * Subscribe to USB device attach/detach events. Simulator boots are not
   * tracked here — callers should re-run `listDevices()` if they need to
   * pick up newly booted simulators.
   */
  startWatching(
    onAttach: DeviceAttachListener,
    onDetach: DeviceDetachListener
  ): void {
    if (this.stopWatchFn) return; // already watching

    let stopped = false;

    watchDevices((event: DeviceEvent) => {
      if (stopped) return;
      if (event.type === "attached" && event.udid) {
        this.deviceIdToUdid.set(event.deviceId, event.udid);
        onAttach({
          udid: event.udid,
          name: event.udid,
          type: "usb",
          deviceId: event.deviceId,
        });
      } else if (event.type === "detached") {
        const udid = this.deviceIdToUdid.get(event.deviceId);
        this.deviceIdToUdid.delete(event.deviceId);
        if (udid) onDetach(udid);
      }
    })
      .then((stop) => {
        if (stopped) {
          // stopWatching() was called before we got the disposer; tear down now.
          stop();
          return;
        }
        this.stopWatchFn = stop;
      })
      .catch(() => {
        // usbmuxd watcher unavailable — silently no-op.
      });

    // Pre-install a synchronous stop handle so subsequent stopWatching() calls
    // before the async hookup completes still flip the `stopped` flag.
    this.stopWatchFn = () => {
      stopped = true;
    };
  }

  /** Stop watching for USB device events. Idempotent. */
  stopWatching(): void {
    if (!this.stopWatchFn) return;
    try {
      this.stopWatchFn();
    } catch {
      /* ignore */
    }
    this.stopWatchFn = null;
  }
}
