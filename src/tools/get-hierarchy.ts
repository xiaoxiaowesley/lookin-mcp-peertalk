import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient, HierarchyItem } from "../client.js";

export const getHierarchyTool: Tool = {
  name: "lookin_get_hierarchy",
  description:
    "Get the view hierarchy tree of the connected iOS app. " +
    "Returns a tree of UI elements with their class names, frames, and object IDs. " +
    "Each node contains oid, className, frame([x,y,w,h]). " +
    "hidden/alpha only appear for non-default values. " +
    "oid can be passed to other lookin_* tools to query attributes or screenshots.",
  inputSchema: {
    type: "object" as const,
    properties: {
      maxDepth: {
        type: "number",
        description:
          "Maximum depth of hierarchy to return. If not provided, returns all levels.",
      },
    },
    required: [],
  },
};

function limitDepth(
  items: HierarchyItem[],
  maxDepth: number,
  currentDepth = 0
): HierarchyItem[] {
  if (maxDepth > 0 && currentDepth >= maxDepth) return [];
  return items.map((item) => ({
    ...item,
    children: limitDepth(item.children, maxDepth, currentDepth + 1),
  }));
}

function countItems(list: HierarchyItem[]): number {
  return list.reduce((sum, item) => sum + 1 + countItems(item.children), 0);
}

export async function handleGetHierarchy(
  client: LookinClient,
  args: { maxDepth?: number }
): Promise<string> {
  const result = await client.getHierarchy();
  const maxDepth = args.maxDepth ?? 0;

  const items = maxDepth > 0 ? limitDepth(result.items, maxDepth) : result.items;

  return JSON.stringify({
    appName: result.appName,
    totalViews: countItems(items),
    hierarchy: items,
  });
}
