import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { WorkspaceEntry } from "../shared/protocol.js";
import { WorkspaceError } from "./workspaces.js";
import type { FileTree } from "../shared/protocol.js";

/**
 * 页面域模型（PRD 约定，grilling Q3:A）：
 * - 页面 = workspace 根下的 `*.html`，入口 jsx 与 html 同名
 * - `index.html` ↔ `App.jsx` 为特例（兼容 example 现状）
 * - 挂载代码在 `<page>.mount.jsx`（模板所有物，非素材），html 内联脚本只做
 *   `import './<page>.mount.jsx'`——esm-x 对内联脚本无 JSX 保证，故挂载不进 HTML
 * - `Components/` 存素材，素材根节点带 `data-fileName`
 */
export class PageError extends Error {
	readonly code: "PAGE_NOT_FOUND" | "BAD_PAGE_NAME" | "PAGE_EXISTS" | "TEMPLATE_MISSING";
	readonly status: number;

	constructor(code: PageError["code"], status: number, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

/** 模板 vendor 来源：html-harness/example（PRD：模板提供，勿手写勿改动） */
const TEMPLATE_VENDOR_DIR = resolve(import.meta.dir, "../../example/vendor");

const PAGE_NAME = /^[a-zA-Z0-9_-]+$/;

export function parsePageName(raw: unknown): string {
	if (typeof raw !== "string" || !PAGE_NAME.test(raw)) {
		throw new PageError("BAD_PAGE_NAME", 400, `Page name must match ${PAGE_NAME}: ${String(raw)}`);
	}
	return raw;
}

/** 页面 → 入口 jsx 文件名：index → App.jsx，其余同名 */
export function entryFileName(page: string): string {
	return page === "index" ? "App.jsx" : `${page}.jsx`;
}

/** 枚举 workspace 根下所有 *.html 页面 */
export async function listPages(workspace: WorkspaceEntry): Promise<string[]> {
	const entries = await readdir(workspace.path, { withFileTypes: true });
	const pages = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
		.map((entry) => entry.name.slice(0, -".html".length));
	pages.sort((a, b) => a.localeCompare(b));
	return pages;
}

/** 解析页面对应入口 jsx 的绝对路径；不存在则报错 */
export async function resolvePageEntry(workspace: WorkspaceEntry, page: string): Promise<string> {
	parsePageName(page);
	const entryPath = join(workspace.path, entryFileName(page));
	const info = await stat(entryPath).catch(() => undefined);
	if (!info?.isFile()) {
		throw new PageError("PAGE_NOT_FOUND", 404, `Page entry not found: ${entryFileName(page)} (workspace ${workspace.name})`);
	}
	return entryPath;
}

/** 左侧文件树：根下页面 + Components/ 下 jsx 素材 */
export async function readFileTree(workspace: WorkspaceEntry): Promise<FileTree> {
	const [pages, componentEntries] = await Promise.all([
		listPages(workspace),
		readdir(join(workspace.path, "Components"), { withFileTypes: true }).catch(() => []),
	]);
	const components = componentEntries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".jsx"))
		.map((entry) => `Components/${entry.name}`)
		.sort((a, b) => a.localeCompare(b));
	return { pages, components };
}

/**
 * 新建页面（grilling R2-Q4:A 最小模板）：
 * vendor/ 从 example 复制；生成 html + mount jsx + 入口 jsx + 空 style.css + Components/
 */
export async function createPage(workspace: WorkspaceEntry, rawPage: unknown): Promise<string> {
	const page = parsePageName(rawPage);
	const htmlPath = join(workspace.path, page === "index" ? "index.html" : `${page}.html`);
	if (await stat(htmlPath).catch(() => undefined)) {
		throw new PageError("PAGE_EXISTS", 409, `Page already exists: ${htmlPath}`);
	}

	const vendorInfo = await stat(TEMPLATE_VENDOR_DIR).catch(() => undefined);
	if (!vendorInfo?.isDirectory()) {
		throw new PageError("TEMPLATE_MISSING", 500, `Template vendor dir not found: ${TEMPLATE_VENDOR_DIR}`);
	}

	// vendor/ 全套复制（esm-x、es-module-shims、react、babel、compiler）
	// vendor 可能已存在（多页面共享），目录级冲突视为已就绪
	await cp(TEMPLATE_VENDOR_DIR, join(workspace.path, "vendor"), { recursive: true }).catch((error) => {
		if (!isVendorAlreadyThere(error)) throw error;
	});

	const entryFile = entryFileName(page);
	const mountFile = `${page}.mount.jsx`;

	// 页面 HTML：结构同 example/index.html，仅内联入口指向 mount
	const html = TEMPLATE_HTML.replaceAll("__ENTRY__", `./${mountFile}`);
	await writeFile(htmlPath, html, "utf8");

	// 挂载文件（模板所有物）：import 入口 jsx + createRoot
	await writeFile(
		join(workspace.path, mountFile),
		`// ${mountFile} —— 模板生成的挂载文件（非素材），交付运行时入口\nimport React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "${entryFile === "App.jsx" ? "./App.jsx" : `./${entryFile}`}";\n\ncreateRoot(document.getElementById("root")).render(React.createElement(App));\n`,
		"utf8",
	);

	// 入口 jsx（素材）：空骨架，带 data-fileName
	if (!(await stat(join(workspace.path, entryFile)).catch(() => undefined))) {
		await writeFile(
			join(workspace.path, entryFile),
			`// ${entryFile} —— 页面根素材\nexport default function App() {\n  return (\n    <div data-fileName="${entryFile}" className="app-root">\n      <h1 className="app-title">${page}</h1>\n    </div>\n  );\n}\n`,
			"utf8",
		);
	}

	// 空 style.css + Components/（已存在则跳过）
	const stylePath = join(workspace.path, "style.css");
	if (!(await stat(stylePath).catch(() => undefined))) await writeFile(stylePath, "/* 全局样式 */\n", "utf8");
	await mkdir(join(workspace.path, "Components"), { recursive: true });

	return page;
}

/** 读取 workspace 内文本文件（防目录穿越），供未来扩展使用 */
export async function readWorkspaceFile(workspace: WorkspaceEntry, relative: string): Promise<string> {
	const target = resolve(workspace.path, relative);
	if (target !== workspace.path && !target.startsWith(workspace.path + (process.platform === "win32" ? "\\" : "/"))) {
		throw new PageError("BAD_PAGE_NAME", 403, `Path escapes workspace: ${relative}`);
	}
	return readFile(target, "utf8");
}

function isVendorAlreadyThere(error: unknown): boolean {
	// cp 对已存在目录在 Windows 下抛 EEXIST/ENOTEMPTY
	const code = (error as { code?: string } | null)?.code;
	return code === "EEXIST" || code === "ENOTEMPTY";
}

const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page</title>
  <link rel="stylesheet" href="./style.css" />

  <!-- 1. esm-x 必须最先（阻塞式）：在 es-module-shims 初始化前设置 shimMode -->
  <script id="esm-x" compiler="babel" loading="circular" src="./vendor/esm-x.js"></script>

  <!-- 2. importmap：react 全家桶映射到本地 ESM 构建 -->
  <script type="importmap">
  {
    "imports": {
      "react": "./vendor/react.js",
      "react-dom": "./vendor/react-dom.js",
      "react-dom/client": "./vendor/react-dom-client.js",
      "scheduler": "./vendor/scheduler.js"
    }
  }
  </script>

  <!-- 3. ES Module Shims -->
  <script async src="./vendor/es-module-shims.js"></script>
</head>
<body>
  <div id="root"></div>

  <!-- 4. 内联入口：esm-x 只读 innerHTML，禁止 src 外链写法（实测静默空白） -->
  <script type="esm-x">
    import '__ENTRY__';
  </script>
</body>
</html>
`;
