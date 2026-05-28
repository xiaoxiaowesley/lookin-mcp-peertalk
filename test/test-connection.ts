/**
 * test/test-connection.ts
 *
 * End-to-end smoke test for Task #4 (ConnectionManager + AppRegistry +
 * port-scanner + DeviceManager).
 *
 * Run:
 *   npx tsx test/test-connection.ts
 *
 * Steps:
 *   1. List devices (USB + booted simulators).
 *   2. Scan simulator ports 47164–47169 in parallel.
 *   3. For each USB device, scan ports 47175–47179 via usbmuxd tunnel.
 *   4. Wrap every successful socket in a PeertalkChannel and register it
 *      with ConnectionManager under a stable portKey.
 *   5. Ping every channel — print server version and device info.
 *   6. List all inspectable apps via AppRegistry.
 *   7. Print the result and clean up.
 */

import { PeertalkChannel } from "../src/peertalk/channel.js";
import { DeviceManager, type DeviceInfo } from "../src/device-manager.js";
import {
  scanSimulatorPorts,
  scanUsbPorts,
  type ScannedPort,
} from "../src/connection/port-scanner.js";
import { ConnectionManager } from "../src/connection/manager.js";
import { AppRegistry } from "../src/connection/app-registry.js";

function makeSimPortKey(port: number): string {
  return `sim:${port}`;
}

function makeUsbPortKey(udid: string, port: number): string {
  return `usb:${udid}:${port}`;
}

async function main() {
  // ── 1. Discover devices ────────────────────────────────────────────────
  const deviceManager = new DeviceManager();
  const devices: DeviceInfo[] = await deviceManager.listDevices();
  console.log(`[devices] found ${devices.length}:`);
  for (const d of devices) {
    console.log(
      `  - ${d.type.padEnd(9)} ${d.name}` +
        (d.deviceId !== undefined ? ` (deviceId=${d.deviceId})` : "") +
        ` [${d.udid}]`
    );
  }

  // Track portKey → udid for AppRegistry.
  const portKeyToUdid = new Map<string, string>();
  const simulatorUdid =
    devices.find((d) => d.type === "simulator")?.udid ?? "";

  // ── 2. Scan simulator ports ───────────────────────────────────────────
  console.log("\n[scan] simulator ports 47164–47169 ...");
  const simPorts: ScannedPort[] = await scanSimulatorPorts();
  console.log(`  → ${simPorts.length} simulator port(s) reachable`);

  // ── 3. Scan USB device ports ──────────────────────────────────────────
  const usbDevices = devices.filter((d) => d.type === "usb" && d.deviceId !== undefined);
  const usbPorts: { udid: string; port: ScannedPort }[] = [];
  for (const dev of usbDevices) {
    console.log(`[scan] USB ${dev.udid} ports 47175–47179 ...`);
    const ports = await scanUsbPorts(dev.deviceId!);
    for (const p of ports) usbPorts.push({ udid: dev.udid, port: p });
    console.log(`  → ${ports.length} USB port(s) reachable for ${dev.udid}`);
  }

  // ── 4. Register channels with ConnectionManager ───────────────────────
  const cm = new ConnectionManager();

  for (const sp of simPorts) {
    const key = makeSimPortKey(sp.port);
    const channel = new PeertalkChannel();
    channel.connect(sp.socket);
    cm.addChannel(key, channel);
    portKeyToUdid.set(key, simulatorUdid);
  }
  for (const { udid, port: sp } of usbPorts) {
    const key = makeUsbPortKey(udid, sp.port);
    const channel = new PeertalkChannel();
    channel.connect(sp.socket);
    cm.addChannel(key, channel);
    portKeyToUdid.set(key, udid);
  }

  const portKeys = cm.getActivePortKeys();
  console.log(`\n[manager] ${portKeys.length} channel(s) registered:`, portKeys);

  if (portKeys.length === 0) {
    console.log("\nNo channels available — make sure a simulator/device is running an app with LookinServer.framework.");
    cm.closeAll();
    return;
  }

  // ── 5. Ping every channel ─────────────────────────────────────────────
  console.log("\n[ping] handshaking each channel ...");
  for (const key of portKeys) {
    try {
      const att = await cm.ping(key);
      console.log(
        `  ✓ ${key}  serverVersion=${att.lookinServerVersion}  background=${att.appIsInBackground}`
      );
    } catch (e) {
      console.log(`  ✗ ${key}  ${(e as Error).message}`);
      cm.removeChannel(key);
    }
  }

  // ── 6. List apps ──────────────────────────────────────────────────────
  console.log("\n[apps] querying LookinRequestType.App on each channel ...");
  const registry = new AppRegistry(cm, {
    resolveUdid: (key) => portKeyToUdid.get(key) ?? "",
  });
  const apps = await registry.listApps();
  console.log(`  → ${apps.length} app(s):`);
  for (const app of apps) {
    console.log(
      `    • [${app.portKey}] ${app.appName} (${app.bundleId})\n` +
        `      device=${app.deviceDescription}  ` +
        `screen=${app.screenWidth}x${app.screenHeight}@${app.screenScale}x  ` +
        `udid=${app.udid}`
    );
  }

  // ── 7. Cleanup ────────────────────────────────────────────────────────
  cm.closeAll();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
