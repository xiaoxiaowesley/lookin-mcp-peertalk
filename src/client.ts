/**
 * LookinClient — high-level API bridging ConnectionManager, AppRegistry,
 * DeviceManager, and the MCP tool layer.
 *
 * Provides a unified facade for:
 *   • Device discovery
 *   • App listing and connection
 *   • View hierarchy retrieval
 *   • Attribute inspection and modification
 *   • Screenshot capture
 */

import { ConnectionManager } from "./connection/manager.js";
import { AppRegistry, type InspectableApp } from "./connection/app-registry.js";
import { DeviceManager, type DeviceInfo } from "./device-manager.js";
import { PeertalkChannel } from "./peertalk/channel.js";
import { LookinRequestType } from "./peertalk/frame-types.js";
import { archive, InlineScalar } from "./peertalk/keyed-archiver.js";
import { scanSimulatorPorts, scanUsbPorts } from "./connection/port-scanner.js";
import "./peertalk/schemas/index.js"; // side-effect: register all schema decoders

import type { LookinHierarchyInfo } from "./peertalk/schemas/LookinHierarchyInfo.js";
import type { LookinDisplayItem } from "./peertalk/schemas/LookinDisplayItem.js";
import type { LookinAttributesGroup } from "./peertalk/schemas/LookinAttributesGroup.js";
import type { LookinAttributesSection } from "./peertalk/schemas/LookinAttributesSection.js";
import type { LookinAttribute } from "./peertalk/schemas/LookinAttribute.js";
import type { ImageData as LookinImageData } from "./peertalk/schemas/_helpers.js";

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ────────────────────────────────────────────────────────────
// Public output interfaces — aligned with original lookin-mcp
// ────────────────────────────────────────────────────────────

export interface HierarchyItem {
  oid: number;
  className: string;
  frame: [number, number, number, number]; // [x, y, w, h]
  hidden?: boolean;
  alpha?: number;
  customTitle?: string;
  children: HierarchyItem[];
}

export interface HierarchyResult {
  appName: string;
  items: HierarchyItem[];
}

export interface AttributeGroup {
  identifier: string | null;
  title: string | null;
  sections: AttributeSection[];
}

export interface AttributeSection {
  identifier: string | null;
  attributes: AttributeInfo[];
}

export interface AttributeInfo {
  identifier: string | null;
  attrType: number;
  value: any;
  displayTitle: string | null;
}

export interface AttributesResult {
  oid: number;
  groups: AttributeGroup[];
}

export interface ScreenshotResult {
  imageBase64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function findItemByOid(
  items: LookinDisplayItem[],
  oid: number
): LookinDisplayItem | null {
  for (const item of items) {
    const itemOid = item.viewObject?.oid ?? item.layerObject?.oid;
    if (itemOid === oid) return item;
    if (item.subitems && item.subitems.length > 0) {
      const found = findItemByOid(item.subitems, oid);
      if (found) return found;
    }
  }
  return null;
}

function convertDisplayItem(item: LookinDisplayItem): HierarchyItem {
  const oid = item.viewObject?.oid ?? item.layerObject?.oid ?? 0;
  const className =
    item.viewObject?.classChainList?.[0] ??
    item.layerObject?.classChainList?.[0] ??
    "Unknown";
  const frame: [number, number, number, number] = item.frame
    ? [item.frame.x, item.frame.y, item.frame.width, item.frame.height]
    : [0, 0, 0, 0];

  const result: HierarchyItem = {
    oid,
    className,
    frame,
    children: (item.subitems ?? []).map(convertDisplayItem),
  };

  if (item.isHidden) result.hidden = true;
  if (item.alpha !== 1) result.alpha = item.alpha;
  if (item.customDisplayTitle) result.customTitle = item.customDisplayTitle;

  return result;
}

function convertAttrGroups(groups: LookinAttributesGroup[]): AttributeGroup[] {
  return groups.map((g) => ({
    identifier: g.identifier,
    title: g.userCustomTitle,
    sections: convertAttrSections(g.attrSections),
  }));
}

function convertAttrSections(
  sections: LookinAttributesSection[]
): AttributeSection[] {
  return sections.map((s) => ({
    identifier: s.identifier,
    attributes: convertAttributes(s.attributes),
  }));
}

function convertAttributes(attrs: LookinAttribute[]): AttributeInfo[] {
  return attrs.map((a) => ({
    identifier: a.identifier,
    attrType: a.attrType,
    value: a.value,
    displayTitle: a.displayTitle,
  }));
}

// ────────────────────────────────────────────────────────────
// LookinClient
// ────────────────────────────────────────────────────────────

export class LookinClient {
  private connectionManager: ConnectionManager;
  private appRegistry: AppRegistry;
  private deviceManager: DeviceManager;
  private activePortKey: string | null = null;
  private cachedHierarchy: LookinHierarchyInfo | null = null;

  constructor() {
    this.connectionManager = new ConnectionManager({
      pingTimeoutMs: 1000,
      requestTimeoutMs: 15000,
    });
    this.appRegistry = new AppRegistry(this.connectionManager);
    this.deviceManager = new DeviceManager();
  }

  // ────────────────────────────────────────────────────────
  // Device management
  // ────────────────────────────────────────────────────────

  async listDevices(): Promise<DeviceInfo[]> {
    return this.deviceManager.listDevices();
  }

  // ────────────────────────────────────────────────────────
  // App management
  // ────────────────────────────────────────────────────────

  async listApps(): Promise<InspectableApp[]> {
    // Ensure channels are established before listing
    await this.ensureChannels();
    return this.appRegistry.listApps();
  }

  /**
   * Connect to a specific app by portKey.
   */
  async connectApp(
    portKey: string
  ): Promise<{ success: boolean; appName: string; message: string }> {
    const channel = this.connectionManager.getChannel(portKey);
    if (!channel) {
      throw new Error(
        `No channel found for portKey "${portKey}". Call listApps() first.`
      );
    }

    // Verify with ping
    const pingResult = await this.connectionManager.ping(portKey);
    this.activePortKey = portKey;

    // Get app info
    const app = await this.appRegistry.getApp(portKey);
    const appName = app?.appName ?? "Unknown App";

    return {
      success: true,
      appName,
      message: `Connected to ${appName} (server version ${pingResult.lookinServerVersion})`,
    };
  }

  /**
   * Scan ports and automatically connect to the first available app.
   */
  async autoConnect(): Promise<void> {
    await this.ensureChannels();

    const portKeys = this.connectionManager.getActivePortKeys();
    if (portKeys.length === 0) {
      throw new Error("No LookinServer instances found");
    }

    // Try to ping each and connect to the first that succeeds
    for (const portKey of portKeys) {
      try {
        await this.connectionManager.ping(portKey);
        this.activePortKey = portKey;
        return;
      } catch {
        // Try next
      }
    }

    throw new Error(
      "Found ports but all ping attempts failed — apps may be in background"
    );
  }

  // ────────────────────────────────────────────────────────
  // Business API
  // ────────────────────────────────────────────────────────

  async getStatus(): Promise<any> {
    this.ensureActive();
    const result = await this.connectionManager.ping(this.activePortKey!);
    return result;
  }

  async getHierarchy(): Promise<HierarchyResult> {
    this.ensureActive();

    const data = await this.connectionManager.request(
      this.activePortKey!,
      LookinRequestType.Hierarchy
    );

    // Response is a LookinHierarchyInfo
    const hierarchyInfo = data as LookinHierarchyInfo;
    this.cachedHierarchy = hierarchyInfo;

    const appName = hierarchyInfo.appInfo?.appName ?? "Unknown App";
    const items = (hierarchyInfo.displayItems ?? []).map(convertDisplayItem);

    return { appName, items };
  }

  async getAttributes(oid: number): Promise<AttributesResult> {
    this.ensureActive();

    // Try cached hierarchy first
    if (this.cachedHierarchy) {
      const item = findItemByOid(
        this.cachedHierarchy.displayItems,
        oid
      );
      if (item && item.attributesGroupList.length > 0) {
        return {
          oid,
          groups: convertAttrGroups(item.attributesGroupList),
        };
      }
    }

    // Fetch from server
    const data = await this.connectionManager.request(
      this.activePortKey!,
      LookinRequestType.AllAttrGroups,
      oid
    );

    // Response should be an array of LookinAttributesGroup
    const groups = Array.isArray(data)
      ? (data as LookinAttributesGroup[])
      : data
        ? [data as LookinAttributesGroup]
        : [];

    return {
      oid,
      groups: convertAttrGroups(groups),
    };
  }

  async modifyAttribute(
    oid: number,
    identifier: string,
    newValue: any
  ): Promise<boolean> {
    this.ensureActive();

    // Build a LookinAttributeModification-compatible object
    const modification = {
      _className: "LookinAttributeModification",
      targetOid: oid,
      setterSelector: identifier,
      attrType: 0, // server will infer from identifier
      value: newValue,
      clientReadableVersion: null,
    };

    await this.connectionManager.request(
      this.activePortKey!,
      LookinRequestType.InbuiltAttrModification,
      modification
    );

    // Invalidate cached hierarchy since view state changed
    this.cachedHierarchy = null;
    return true;
  }

  async getScreenshot(oid?: number): Promise<ScreenshotResult> {
    this.ensureActive();

    let targetOid = oid;

    // If no oid specified, use smart selection from hierarchy
    if (targetOid === undefined) {
      if (!this.cachedHierarchy) {
        await this.getHierarchy();
      }
      if (this.cachedHierarchy && this.cachedHierarchy.displayItems.length > 0) {
        targetOid = this.findScreenshotTarget(this.cachedHierarchy.displayItems) ?? undefined;
        if (targetOid == null) {
          // Fallback to root window oid
          const rootItem = this.cachedHierarchy.displayItems[0];
          targetOid = rootItem.viewObject?.oid ?? rootItem.layerObject?.oid ?? 0;
        }
      } else {
        throw new Error("No views found in hierarchy");
      }
    }

    // First try cached screenshots from hierarchy
    if (this.cachedHierarchy) {
      const item = findItemByOid(
        this.cachedHierarchy.displayItems,
        targetOid
      );
      if (item) {
        const imgData = item.groupScreenshot ?? item.soloScreenshot;
        if (imgData) {
          return this.imageDataToResult(imgData);
        }
      }
    }

    // Fetch from server via HierarchyDetails (supports any view, not just UIImageView)
    const hdTask = {
      _className: "LookinStaticAsyncUpdateTask",
      oid: targetOid,
      taskType: new InlineScalar(2),              // GroupScreenshot
      clientReadableVersion: "1.0.7",
      attrRequest: new InlineScalar(2),           // NotNeed
      needBasisVisualInfo: new InlineScalar(false),
      needSubitems: new InlineScalar(false),
    };
    const hdPkg = {
      _className: "LookinStaticAsyncUpdateTasksPackage",
      tasks: [hdTask],
    };

    const chunks = await this.connectionManager.request(
      this.activePortKey!,
      LookinRequestType.HierarchyDetails,
      [hdPkg]
    );

    // Flatten multi-frame response
    const allDetails = Array.isArray(chunks) ? chunks.flat() : [chunks];
    const detail = allDetails.find((d: any) => d?.displayItemOid === targetOid);
    if (detail) {
      const img = detail.groupScreenshot ?? detail.soloScreenshot;
      if (img) {
        return this.imageDataToResult(img);
      }
    }

    throw new Error(`No screenshot available for oid ${targetOid}`);
  }

  // ────────────────────────────────────────────────────────
  // Cleanup
  // ────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.connectionManager.closeAll();
    this.deviceManager.stopWatching();
    this.activePortKey = null;
    this.cachedHierarchy = null;
  }

  // ────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────

  private ensureActive(): void {
    if (!this.activePortKey) {
      throw new Error(
        "No active connection. Call connectApp() or autoConnect() first."
      );
    }
    if (!this.connectionManager.getChannel(this.activePortKey)) {
      this.activePortKey = null;
      throw new Error("Active connection lost. Please reconnect.");
    }
  }

  /**
   * Scan for simulator and USB ports, create PeertalkChannels for each
   * discovered socket, and register them with the ConnectionManager.
   */
  private async ensureChannels(): Promise<void> {
    const existingKeys = this.connectionManager.getActivePortKeys();
    if (existingKeys.length > 0) return; // Already have channels

    // Scan simulator ports
    const simPorts = await scanSimulatorPorts();
    for (const sp of simPorts) {
      const portKey = `sim:${sp.port}`;
      if (!this.connectionManager.getChannel(portKey)) {
        const channel = new PeertalkChannel();
        channel.connect(sp.socket);
        this.connectionManager.addChannel(portKey, channel);
      }
    }

    // Scan USB devices
    const devices = await this.deviceManager.listDevices();
    const usbDevices = devices.filter((d) => d.type === "usb" && d.deviceId !== undefined);
    for (const dev of usbDevices) {
      const usbPorts = await scanUsbPorts(dev.deviceId!);
      for (const up of usbPorts) {
        const portKey = `usb:${dev.udid}:${up.port}`;
        if (!this.connectionManager.getChannel(portKey)) {
          const channel = new PeertalkChannel();
          channel.connect(up.socket);
          this.connectionManager.addChannel(portKey, channel);
        }
      }
    }
  }

  /**
   * Score hierarchy items to find the best screenshot target.
   * Prefers visible nodes with shouldCaptureImage=true at moderate depth.
   */
  private findScreenshotTarget(items: LookinDisplayItem[]): number | null {
    let bestOid: number | null = null;
    let bestScore = -1;

    const walk = (it: LookinDisplayItem, depth: number) => {
      const oid = it.viewObject?.oid ?? it.layerObject?.oid;
      if (typeof oid !== "number") {
        for (const c of it.subitems ?? []) walk(c, depth + 1);
        return;
      }
      let score = 0;
      if (it.shouldCaptureImage) score += 10;
      if (!it.isHidden && it.alpha > 0) score += 5;
      const f = it.frame;
      if (f && f.width > 10 && f.height > 10) score += 5;
      if (depth >= 3 && depth <= 6) score += 3;
      if (depth > 10) score -= 2;
      if (score > bestScore) { bestScore = score; bestOid = oid; }
      for (const c of it.subitems ?? []) walk(c, depth + 1);
    };
    for (const it of items) walk(it, 1);
    return bestOid;
  }

  private imageDataToResult(imgData: LookinImageData): ScreenshotResult {
    const base64 = imgData.imageData.toString("base64");
    const mimeType =
      imgData.format === "png"
        ? "image/png"
        : imgData.format === "jpeg"
          ? "image/jpeg"
          : "image/png";

    // If > 500KB, write to temp file and return path reference
    if (imgData.imageData.length > 500 * 1024) {
      const tmpFile = path.join(
        os.tmpdir(),
        `lookin-screenshot-${Date.now()}.${imgData.format === "jpeg" ? "jpg" : "png"}`
      );
      fs.writeFileSync(tmpFile, imgData.imageData);
      return {
        imageBase64: base64,
        mimeType,
      };
    }

    return { imageBase64: base64, mimeType };
  }

  private bufferToResult(buf: Buffer, format: "png" | "jpeg" | "unknown"): ScreenshotResult {
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    return {
      imageBase64: buf.toString("base64"),
      mimeType,
    };
  }
}

function detectFormat(buf: Buffer): "png" | "jpeg" | "unknown" {
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return "png";
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "jpeg";
    }
  }
  return "unknown";
}
