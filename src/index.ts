#!/usr/bin/env node
/**
 * lookin-mcp-peertalk — MCP Server
 *
 * Implements the MCP protocol via stdio, connecting to iOS apps through
 * the native Peertalk/usbmuxd protocol (no HTTP proxy needed).
 *
 * Tools:
 *   • lookin_list_devices    — list simulators + USB devices
 *   • lookin_list_apps       — list apps running LookinServer
 *   • lookin_connect_app     — connect to a specific app by portKey
 *   • lookin_get_hierarchy   — get UI view hierarchy tree
 *   • lookin_get_attributes  — query attributes of a view by oid
 *   • lookin_get_screenshot  — capture a view screenshot
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { LookinClient } from "./client.js";

import { listDevicesTool, handleListDevices } from "./tools/list-devices.js";
import { listAppsTool, handleListApps } from "./tools/list-apps.js";
import { connectAppTool, handleConnectApp } from "./tools/connect-app.js";
import { getHierarchyTool, handleGetHierarchy } from "./tools/get-hierarchy.js";
import { getAttributesTool, handleGetAttributes } from "./tools/get-attributes.js";
import { getScreenshotTool, handleGetScreenshot } from "./tools/get-screenshot.js";

// ──────────────────────────────────────────────────────────────
// Server setup
// ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "lookin-mcp-peertalk", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const client = new LookinClient();

// ──────────────────────────────────────────────────────────────
// List tools
// ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    listDevicesTool,
    listAppsTool,
    connectAppTool,
    getHierarchyTool,
    getAttributesTool,
    getScreenshotTool,
  ],
}));

// ──────────────────────────────────────────────────────────────
// Call tool
// ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "lookin_list_devices": {
        const text = await handleListDevices(client);
        return { content: [{ type: "text" as const, text }] };
      }

      case "lookin_list_apps": {
        const text = await handleListApps(client);
        return { content: [{ type: "text" as const, text }] };
      }

      case "lookin_connect_app": {
        const text = await handleConnectApp(
          client,
          args as { portKey: string }
        );
        return { content: [{ type: "text" as const, text }] };
      }

      case "lookin_get_hierarchy": {
        const text = await handleGetHierarchy(
          client,
          args as { maxDepth?: number }
        );
        return { content: [{ type: "text" as const, text }] };
      }

      case "lookin_get_attributes": {
        const text = await handleGetAttributes(
          client,
          args as { oid: number }
        );
        return { content: [{ type: "text" as const, text }] };
      }

      case "lookin_get_screenshot": {
        const content = await handleGetScreenshot(
          client,
          args as { oid?: number }
        );
        return { content: content as any };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ──────────────────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Attempt auto-connect (non-fatal if no devices found)
  try {
    await client.autoConnect();
    process.stderr.write("[lookin-mcp-peertalk] Auto-connected successfully\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[lookin-mcp-peertalk] Auto-connect skipped: ${msg}\n`);
  }

  process.stderr.write("[lookin-mcp-peertalk] Server started\n");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await client.shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await client.shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(
    `[lookin-mcp-peertalk] Fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
