import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const listAppsTool: Tool = {
  name: "lookin_list_apps",
  description:
    "List all inspectable iOS apps running LookinServer. " +
    "Call this after list_devices to see available apps. " +
    "Returns portKey identifiers needed for connect_app.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handleListApps(client: LookinClient): Promise<string> {
  const apps = await client.listApps();
  return JSON.stringify(
    {
      apps,
      hint:
        apps.length === 0
          ? "No apps found with LookinServer running. Make sure your iOS app has LookinServer integrated and is in the foreground."
          : `Found ${apps.length} app(s). Use lookin_connect_app with a portKey to connect.`,
    },
    null,
    2
  );
}
