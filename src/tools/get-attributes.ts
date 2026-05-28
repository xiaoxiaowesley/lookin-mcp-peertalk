import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const getAttributesTool: Tool = {
  name: "lookin_get_attributes",
  description:
    "Get detailed attributes of a specific view by its object ID (oid). " +
    "Use oid from lookin_get_hierarchy result. " +
    "Returns attributes classified by group and section, each attribute contains:\n" +
    "- identifier: attribute identifier\n" +
    "- attrType: value type enum (14=BOOL, 12=float, 13=double, 5=NSInteger, " +
    "20=CGRect, 17=CGPoint, 19=CGSize, 22=UIEdgeInsets, " +
    "23=UIColor, 25=enum int, 26=enum long, 24=NSString)\n" +
    "- value: current value",
  inputSchema: {
    type: "object" as const,
    properties: {
      oid: {
        type: "number",
        description:
          "Object ID of the view to inspect (get from lookin_get_hierarchy's oid field)",
      },
    },
    required: ["oid"],
  },
};

export async function handleGetAttributes(
  client: LookinClient,
  args: { oid: number }
): Promise<string> {
  const result = await client.getAttributes(args.oid);
  return JSON.stringify(result);
}
