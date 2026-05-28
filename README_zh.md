# lookin-mcp-peertalk

>  [English](./README.md)

[Lookin](https://github.com/hughkli/Lookin) 的 MCP (Model Context Protocol) 版本。

与 Lookin 桌面客户端完美兼容 —— 你可以继续使用 Lookin App 进行可视化调试，同时搭配 LLM + MCP，用自然语言检查和调试 iOS 应用的 UI。

通过 Peertalk 协议直接与 iOS 设备通信，无需中间 HTTP 代理，支持 USB 真机和模拟器。


## Prerequisites: 安装 LookinServer

你的 iOS 应用需要集成 [LookinServer](https://github.com/QMUI/LookinServer) SDK。请选择以下任一方式：

### CocoaPods

**Swift 项目：**

```ruby
pod 'LookinServer', :subspecs => ['Swift'], :configurations => ['Debug']
```

**Objective-C 项目：**

```ruby
pod 'LookinServer', :configurations => ['Debug']
```

### Swift Package Manager

添加以下仓库地址：

```
https://github.com/QMUI/LookinServer/
```

> 注意：仅在 Debug 配置下引入，避免影响 Release 包体积。

## 安装 MCP

### 方式一：npx（推荐）

**Claude Code：**

```bash
claude mcp add --scope user lookin-peertalk -- npx -y lookin-mcp-peertalk
```

**Claude Desktop / Cursor 等 MCP 客户端：**

在 MCP 配置文件中添加：

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

### 方式二：从源码构建

```bash
git clone https://github.com/nicklxz/lookin-mcp-peertalk.git
cd lookin-mcp-peertalk
npm install
npm run build
```

然后在 MCP 配置文件中添加：

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

### 方式三：开发模式（无需编译）

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

## 可用工具

安装完成后，LLM 可以使用以下 6 个工具来检查 iOS 应用：

### `lookin_list_devices`

列出所有可连接的 iOS 设备（USB 真机和模拟器）。

- **参数**：无
- **返回**：设备列表，包含设备类型和标识信息

### `lookin_list_apps`

列出所有正在运行 LookinServer 的应用。

- **参数**：无
- **返回**：应用列表，包含 `portKey`、`appName`、`bundleId` 等信息

### `lookin_connect_app`

连接到指定的 iOS 应用。

- **参数**：
  - `portKey` (string, 必填) — 来自 `lookin_list_apps` 返回的应用标识
- **返回**：连接结果，包含应用基本信息

### `lookin_get_hierarchy`

获取已连接应用的视图层级树。

- **参数**：
  - `maxDepth` (number, 可选) — 限制返回的层级深度，不传则返回完整层级
- **返回**：JSON 格式的视图树，每个节点包含 `oid`、`className`、`frame`（[x, y, w, h]）、`children` 等字段

### `lookin_get_attributes`

查询指定视图的详细属性。

- **参数**：
  - `oid` (number, 必填) — 视图的对象 ID，来自 `lookin_get_hierarchy` 的返回结果
- **返回**：按分组归类的属性列表，包含 bounds、backgroundColor、font 等详细信息

### `lookin_get_screenshot`

截取指定视图的截图。

- **参数**：
  - `oid` (number, 可选) — 视图的对象 ID。不传则截取根窗口
- **返回**：base64 编码的 PNG 图片数据

## 使用示例

### 分步调用

1. **列出设备** — 使用 `lookin_list_devices` 查看可用设备
2. **列出应用** — 使用 `lookin_list_apps` 列出正在运行 LookinServer 的应用
3. **连接应用** — 使用 `lookin_connect_app` 连接到目标应用（传入步骤 2 返回的 `portKey`）
4. **获取视图层级** — 使用 `lookin_get_hierarchy` 获取当前应用的视图层级树
5. **查看属性** — 使用 `lookin_get_attributes` 查询某个视图的属性（传入步骤 4 中的 `oid`）
6. **获取截图** — 使用 `lookin_get_screenshot` 截取某个视图的截图（传入步骤 4 中的 `oid`）

**调用流程：**

```
list_devices → list_apps → connect_app → get_hierarchy → get_attributes / get_screenshot
```

### 自然语言调用（推荐）

直接用自然语言描述你的需求，LLM 会自动编排工具调用：

> "帮我连接到正在运行的 iOS 应用，然后获取它的视图层级，找到一个 UILabel 并查看它的属性和截图"

LLM 会自动按顺序调用 `list_devices` → `list_apps` → `connect_app` → `get_hierarchy` → `get_attributes` → `get_screenshot`，一个流程覆盖所有工具。

## License

MIT
