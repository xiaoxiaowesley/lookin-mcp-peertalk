import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const connectAppTool: Tool = {
  name: "lookin_connect_app",
  description:
    "Connect to a specific iOS app for inspection. " +
    "Use portKey from lookin_list_apps result. " +
    "After connecting, you can use get_hierarchy, get_attributes, and get_screenshot.",
  inputSchema: {
    type: "object" as const,
    properties: {
      portKey: {
        type: "string",
        description:
          "The portKey identifier of the app to connect to (from lookin_list_apps result)",
      },
    },
    required: ["portKey"],
  },
};

export async function handleConnectApp(
  client: LookinClient,
  args: { portKey: string }
): Promise<string> {
  const result = await client.connectApp(args.portKey);
  return JSON.stringify(result, null, 2);
}
