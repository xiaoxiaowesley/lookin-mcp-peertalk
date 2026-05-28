# lookin-mcp-peertalk

An MCP (Model Context Protocol) server for [Lookin](https://github.com/hughkli/Lookin) — inspect and debug iOS app UI in natural language with any LLM.

Fully compatible with the official Lookin desktop client: keep using the Lookin App for visual debugging, and pair it with an LLM + MCP to query, inspect and reason about your iOS UI in plain English.

Talks to iOS devices directly over the **Peertalk** protocol — no HTTP proxy in the middle. Works with USB-connected real devices and the iOS Simulator.

> 中文版本: [README_zh.md](./README_zh.md)

## Prerequisites: Install LookinServer

Your iOS app must integrate the [LookinServer](https://github.com/QMUI/LookinServer) SDK. Pick either of the following:

### CocoaPods

**Swift project:**

```ruby
pod 'LookinServer', :subspecs => ['Swift'], :configurations => ['Debug']
```

**Objective-C project:**

```ruby
pod 'LookinServer', :configurations => ['Debug']
```

### Swift Package Manager

Add the following repository:

```
https://github.com/QMUI/LookinServer/
```

> Note: only integrate it in the Debug configuration to avoid bloating your Release binary.

## Install the MCP server

### Option 1: npx (recommended)

**Claude Code:**

```bash
claude mcp add --scope user lookin-peertalk -- npx -y lookin-mcp-peertalk
```

**Claude Desktop / Cursor and other MCP clients:**

Add the following entry to your MCP config file:

```json
{
  "mcpServers": {
    "lookin-peertalk": {
      "command": "npx",
      "args": ["-y", "lookin-mcp-peertalk"]
    }
  }
}
```

### Option 2: Build from source

```bash
git clone https://github.com/nicklxz/lookin-mcp-peertalk.git
cd lookin-mcp-peertalk
npm install
npm run build
```

Then register it in your MCP config file:

```json
{
  "mcpServers": {
    "lookin-peertalk": {
      "command": "node",
      "args": ["/absolute/path/to/lookin-mcp-peertalk/dist/index.js"]
    }
  }
}
```

### Option 3: Development mode (no build step)

```json
{
  "mcpServers": {
    "lookin-peertalk": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/lookin-mcp-peertalk/src/index.ts"]
    }
  }
}
```

## Available tools

Once installed, the LLM can use the following 6 tools to inspect your iOS app:

### `lookin_list_devices`

List all connectable iOS devices (USB real devices and simulators).

- **Arguments**: none
- **Returns**: a list of devices with their type and identifier

### `lookin_list_apps`

List all running apps that have LookinServer integrated.

- **Arguments**: none
- **Returns**: a list of apps including `portKey`, `appName`, `bundleId`, etc.

### `lookin_connect_app`

Connect to a specific iOS app.

- **Arguments**:
  - `portKey` (string, required) — the app identifier returned by `lookin_list_apps`
- **Returns**: the connection result, including basic app info

### `lookin_get_hierarchy`

Fetch the view hierarchy tree of the currently connected app.

- **Arguments**:
  - `maxDepth` (number, optional) — limit the depth of the returned tree; omit to get the full hierarchy
- **Returns**: a JSON view tree where each node contains `oid`, `className`, `frame` (`[x, y, w, h]`), `children`, etc.

### `lookin_get_attributes`

Fetch detailed attributes for a specific view.

- **Arguments**:
  - `oid` (number, required) — the object ID of the view, taken from `lookin_get_hierarchy`
- **Returns**: a grouped list of attributes including bounds, backgroundColor, font, and many more

### `lookin_get_screenshot`

Take a screenshot of a specific view.

- **Arguments**:
  - `oid` (number, optional) — the object ID of the view; if omitted, captures the root window
- **Returns**: PNG image data, base64 encoded

## Usage examples

### Step-by-step

1. **List devices** — call `lookin_list_devices` to see what's available
2. **List apps** — call `lookin_list_apps` to find apps running LookinServer
3. **Connect** — call `lookin_connect_app` with the `portKey` from step 2
4. **Get the view hierarchy** — call `lookin_get_hierarchy`
5. **Inspect attributes** — call `lookin_get_attributes` with an `oid` from step 4
6. **Take a screenshot** — call `lookin_get_screenshot` with an `oid` from step 4

**Typical flow:**

```
list_devices → list_apps → connect_app → get_hierarchy → get_attributes / get_screenshot
```

### Natural language (recommended)

Just describe what you want in natural language and let the LLM orchestrate the tool calls:

> "Connect to the iOS app that's currently running, fetch its view hierarchy, find a UILabel, then show me its attributes and a screenshot."

The LLM will chain `list_devices` → `list_apps` → `connect_app` → `get_hierarchy` → `get_attributes` → `get_screenshot` automatically — one prompt, the whole flow.

## License

MIT
