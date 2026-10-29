# prd-ui — 漏洞发布平台原型（素材化 JSX）

由原纯静态 HTML/CSS/JS 原型拆分而来，遵循 `pi/html-harness` 的素材模板：
无脚手架、无构建步骤，JSX 由 esm-x 在浏览器内用 Babel 实时编译。

## 目录结构

```
prd-ui/
├── index.html            # 页面1：安全通知（内联 esm-x 入口 → index.mount.jsx）
├── index.mount.jsx       # 模板挂载文件（非素材）
├── App.jsx               # 页面1 根素材
├── detail.html           # 页面2：漏洞详情（内联 esm-x 入口 → detail.mount.jsx）
├── detail.mount.jsx      # 模板挂载文件（非素材）
├── detail.jsx            # 页面2 根素材
├── data.js               # 数据（ESM 导出 VULN_DATA，替换即可更新内容）
├── style.css             # 全局样式
├── Components/           # 素材目录（每个素材根节点带 data-fileName）
├── vendor/               # 公共依赖（模板提供，勿改动）
├── server.js             # 零依赖静态服务
├── 数据来源映射.md       # UI 组件 ↔ xlsx 字段对照
└── _legacy/              # 拆分前的原生 JS 版本（仅留档，可删除）
```

## 运行

```bash
node server.js
# → http://localhost:5600/index.html
# → http://localhost:5600/detail.html
```

也可以把 `prd-ui` 作为工作目录交给 designer（`PI_WEB_ROOT` 指向其父目录），
页面列表会识别 `index` / `detail`，素材树列出 `Components/*.jsx`。

## 约定

- 素材根节点带 `data-fileName`（值为相对工作目录的路径），供 Add To Context 使用。
- JSX 全部使用相对路径 `import`，禁止 `<script type="esm-x" src="...">` 外链。
- Babel 走 classic runtime，因此每个 jsx 文件都显式 `import React from "react"`。
- 更新内容只改 `data.js`；改结构/样式改对应素材或 `style.css`。
- 同一套素材在两种运行时下渲染一致：
  - 交付运行时：`index.html` / `detail.html`（esm-x + 浏览器内 Babel，`style.css` 由 `<link>` 全局加载）
  - 沙盒运行时：designer `/preview`（Bun.build 打包后挂到 `#preview-container`；designer 会把 `style.css` 重写为 `#preview-container` 作用域后注入，避免污染设计器 UI）
