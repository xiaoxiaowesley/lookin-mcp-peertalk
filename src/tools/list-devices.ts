import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const listDevicesTool: Tool = {
  name: "lookin_list_devices",
  description:
    "List all connectable iOS targets: USB physical devices and booted simulators. " +
    "Shows available inspection targets. Call this first to see what devices are available.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handleListDevices(client: LookinClient): Promise<string> {
  const devices = await client.listDevices();
  return JSON.stringify(
    {
      devices,
      hint:
        devices.length === 0
          ? "No devices found. Make sure a simulator is booted or a physical device is connected via USB."
          : `Found ${devices.length} device(s). Use lookin_list_apps to see running apps with LookinServer.`,
    },
    null,
    2
  );
}
