# html-harness · designer（Agent 驱动的页面设计器）

**一个 Bun 进程**承载 pi 会话、预览打包与静态服务；前端 React 19 + Vite，
左侧文件树 + 预览，右侧固定对话栏（VS Code chat 风格）。

首期验收标准已实现并通过：

> 选中组件后通过发消息，Agent 可以修改对应素材的内容。

## 运行

```bash
bun install

# 生产模式（单端口，前端走 web-dist）
bun run build
bun run dev          # → http://localhost:5602

# 开发模式（两个终端）
bun run dev          # 后端 :5602
bun run web          # Vite :5173，已 proxy /api /ws /preview /w
```

环境变量（与 skeleton 一致）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PI_WEB_PORT` | `5602` | 单端口：前端 + `/api` + `/ws` + `/preview` + `/w` |
| `PI_WEB_ROOT` | `process.cwd()` | 根目录；一级子目录即 workspace |
| `PI_AGENT_DIR` | `getAgentDir()` | 全局 pi 配置（auth / models / sessions / trust） |

示例：

```bash
PI_WEB_ROOT="$HOME/pi-workspaces" bun run dev
```

## 验证

```bash
bun spike.ts            # M0：Bun 下 createAgentSession + read/edit 工具链
bun test-acceptance.ts  # 端到端协议验收（WS → Add To Context → Agent 改文件 → 预览重建）
bun test-ui.ts          # 真实浏览器验收（Chrome headless + CDP，产出 acceptance-screenshot.png）
```

`test-acceptance.ts` / `test-ui.ts` 需要后端已在运行、且 `.test-root/demo` 工作区存在页面 `index`
（`test-acceptance.ts` 首次运行前用 `POST /api/pages` 建页面即可，见下方“新建页面”）。

## 架构

```
浏览器（React 19 + Vite）
├── 左侧 workbench
│   ├── 文件树         pages(*.html) + Components/*.jsx（jsx 右键 Add To Context）
│   └── 预览            fetch /preview/<ws>/<page> → blob → import() → 自挂载到 #preview-container
│                     选中开关：hover 高亮 → 单击选中 → 浮层 Add To Context
└── 右侧对话栏         Transcript / Composer(chips) / StatusBar / 扩展对话框
        │ ws://…/ws?workspace=&clientId=
        ▼
Bun 单进程（server.ts）
├── /api/workspaces   GET 列表 / POST 新建
├── /api/pages        GET 页面列表 / POST 新建页面（最小模板）
├── /api/files        GET 文件树
├── /ws               pi AgentSession（Bun 原生 WebSocket，一条连接 = 一个 workspace）
├── /preview/<ws>/<p> Bun.build 虚拟入口打包（react 打进 bundle，自挂载）
├── /w/<ws>/<path>    workspace 静态服务（交付运行时页面、vendor、style.css）
└── web-dist/         设计器前端（生产模式）
```

分层沿用 skeleton：`src/services.ts`（L1 服务装配）→ `src/runtime.ts`（L2 AgentSession 生命周期）
→ `src/web/transport.ts`（L3 单连接协议）→ `src/web/server.ts`（L4 编排，Bun.serve）。

### 双运行时一致性

| 环境 | 入口 | 挂载 | 用途 |
|---|---|---|---|
| 沙盒运行时（设计器内） | `/preview/<ws>/<page>` → Bun.build | bundle 内 `createRoot(#preview-container)` | 实时预览、组件选中 |
| 交付运行时（`交付物 ↗`） | `/w/<ws>/<page>.html` → esm-x + 浏览器内 Babel | `<page>.mount.jsx` → `createRoot(#root)` | 最终交付物 |

同一套素材 jsx 在两个环境都能运行：素材根节点带 `data-fileName`，`App.jsx` 只 `export default`
根组件（挂载代码在模板生成的 `<page>.mount.jsx` 里，不污染素材）。

全局样式：交付运行时由页面 `<link rel="stylesheet" href="./style.css">` 加载；沙盒运行时由
`buildPageStyles` 解析页面 HTML 的 `<link rel="stylesheet">` / `<style>`（不再硬编码 `style.css`），
递归内联 `@import`、把相对 `url()` 重写为 `/w/<ws>/...`，再经 `shared/css.ts` 改写为
`#preview-container` 作用域，通过 `GET /preview/styles/<ws>/<page>` 注入 `<style>`。
素材里 `import "./x.css"` 的样式由 Bun 产出独立 CSS 输出，同样作用域化后随 bundle 注入。

预览面板（`.preview-stage`）声明 `container-type: inline-size`，纯宽度 `@media` 会被改写成
`@container`，让响应式按面板宽度而不是设计器窗口生效；`#preview-container` 用
`contain: layout paint` 把页面的 `position: fixed`（浮动按钮 / Toast）约束在预览区内。
仍不一致的部分：`vw/vh` 单位、CDN `<script>` 注入的样式（如 Tailwind CDN）——需要 iframe 预览才能完全等价。

### 关键设计决策（grilling 结论）

- **单 Bun 进程单端口**；`Bun.serve` 原生 WebSocket 取代 skeleton 的 `ws` 包。
- **pi 工具全开放**：read / write / edit / bash 等全部默认工具，无任何裁剪。
- **预览 = 沙盒运行时，同文档渲染**：设计器自身 React 与 bundle 内 React 互不交互；
  选中与 Add To Context 全部走 DOM 事件（`[data-fileName]` + 事件捕获），无需 postMessage。
- **手动刷新**（不做 fs.watch 自动推送）：工具栏「刷新」重新打包并 remount；构建失败显示错误面板 + 重试。
- **Add To Context**：选中组件的 `data-fileName` 作为 chip 注入输入区，可叠加/移除；
  发送时拼成 `请处理以下素材：\n- @<path>\n\n<用户文本>`，发送后清空 chips。
- **页面体系**：页面 = 根下 `*.html`，入口 jsx 同名（`index.html` ↔ `App.jsx` 特例）；
  默认打开文件树里第一个 html；新建页面复制 `../example/vendor` 全套并生成模板文件。

### 页面模板（新建页面生成）

```
<workspace>/
├── index.html          # 内联 esm-x 入口：import './index.mount.jsx'
├── index.mount.jsx     # 模板所有物：import App + createRoot(#root)
├── App.jsx             # 素材：export default 根组件，带 data-fileName
├── style.css           # 全局样式
├── Components/         # 素材目录
└── vendor/             # 从 ../example 复制的公共依赖
```

## 首期范围之外（二期）

编辑模式、组件树模式、素材跳转（右键菜单扩展）、fs.watch 自动刷新、多标签会话。
