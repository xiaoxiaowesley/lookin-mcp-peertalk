import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const getScreenshotTool: Tool = {
  name: "lookin_get_screenshot",
  description:
    "Capture a screenshot of a specific view or the entire app. " +
    "Returns a base64-encoded PNG image. " +
    "oid is optional — if not provided, captures the root window. " +
    "Each call retrieves the screenshot from the iOS app in real-time.",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "Object ID of the view to screenshot (from lookin_get_hierarchy's oid field). " +
          "If not provided, defaults to the root window.",
      },
    },
    required: [],
  },
};

export async function handleGetScreenshot(
  client: LookinClient,
  args: { oid?: number }
): Promise<Array<{ type: string; data?: string; mimeType?: string; text?: string }>> {
  const result = await client.getScreenshot(args.oid);

  if (!result.imageBase64) {
    return [{ type: "text", text: "Screenshot not available for this view." }];
  }

  return [
    {
      type: "image",
      data: result.imageBase64,
      mimeType: result.mimeType ?? "image/png",
    },
    {
      type: "text",
      text: `Screenshot captured${result.width && result.height ? `: ${result.width}×${result.height}px` : ""}`,
    },
  ];
}
