import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { BunPlugin } from "bun";
import type { WorkspaceEntry } from "../shared/protocol.js";
import { PREVIEW_CONTAINER_ID, rewriteCssUrls, scopeCss } from "../shared/css.js";
import { parsePageName, resolvePageEntry } from "./pages.js";

/**
 * 预览打包（沙盒运行时，grilling R2-Q1:A 的落地形态）：
 *
 * - 虚拟入口：import 页面入口 jsx（App.jsx 约定为 export default，无挂载副作用），
 *   把挂载代码打进 bundle——挂到设计器预览容器的固定 id `preview-container` 上
 * - react/react-dom/scheduler 从本目录 node_modules 打进 bundle（沿用 sandbox 的
 *   onResolve 方案；Bun 1.4.0 Windows 下 build alias 不生效，实测踩坑）
 * - 设计器自身是独立的 React 应用，与 bundle 内的 React 实例互不交互：
 *   预览 DOM 直接落在同文档里，选中/Add To Context 全部走 DOM 事件，无需跨实例
 * - 交付运行时（window.open 的 esm-x 页面）与本 bundle 共享同一套素材 jsx
 * - 入口用 os.tmpdir 下的临时文件承载（Bun.build entrypoints 需真实存在的文件），
 *   入口对 App 的引用走 __preview_app__ 说明符由 onResolve 映射到真实路径
 *
 * 样式：
 * - 素材里 `import "./x.css"` 时 Bun 会产出独立 CSS 输出（历史实现只取 outputs[0]，
 *   样式被静默丢弃）；这里收集所有 CSS 输出、作用域化后由 bundle 自己注入 <style>。
 * - 页面级样式（交付运行时的 `<link rel="stylesheet">` / `<style>`）不在 bundle 里，
 *   由 `buildPageStyles` 解析页面 HTML 后经 GET /preview/styles/<ws>/<page> 注入。
 * - 相对 url() 必须重写成 /w/<ws>/...：注入 <style> 后以设计器文档为基准会 404。
 */
const CONTAINER_ID = PREVIEW_CONTAINER_ID;
const APP_SPECIFIER = "__preview_app__";
const BUNDLE_STYLE_ID = "preview-bundle-style";
/**
 * 素材里的图片/字体直接内联，避免产出无法服务的独立资源文件。
 * bun-types 1.2 的 Loader 联合类型尚未包含 "dataurl"（Bun 运行时支持），故在调用处收窄。
 */
const INLINE_ASSET_LOADERS: Record<string, string> = {
	".png": "dataurl",
	".jpg": "dataurl",
	".jpeg": "dataurl",
	".gif": "dataurl",
	".webp": "dataurl",
	".avif": "dataurl",
	".svg": "dataurl",
	".woff": "dataurl",
	".woff2": "dataurl",
	".ttf": "dataurl",
	".otf": "dataurl",
};

const npmPlugin: BunPlugin = {
	name: "npm-alias",
	setup(build) {
		const NM = path.resolve(import.meta.dir, "../node_modules");
		build.onResolve({ filter: /^(react|react-dom|scheduler)(\/.+)?$/ }, async (args) => {
			for (const candidate of [`${NM}/${args.path}.js`, `${NM}/${args.path}/index.js`]) {
				if (await Bun.file(candidate).exists()) return { path: candidate };
			}
			return undefined;
		});
	},
};

function appResolverPlugin(appPath: string): BunPlugin {
	return {
		name: "preview-app-resolver",
		setup(build) {
			build.onResolve({ filter: new RegExp(`^${APP_SPECIFIER}$`) }, () => ({ path: appPath }));
		},
	};
}

export interface PreviewBuildResult {
	ok: boolean;
	/** ESM bundle 文本（ok=true）或构建错误日志（ok=false） */
	code: string;
}

/** 打包页面的预览 bundle：入口 jsx 整图打包成单 ESM 文件，自挂载到 preview-container */
export async function buildPreview(workspace: WorkspaceEntry, page: string): Promise<PreviewBuildResult> {
	let appPath: string;
	try {
		appPath = await resolvePageEntry(workspace, page);
	} catch (error) {
		return { ok: false, code: error instanceof Error ? error.message : String(error) };
	}

	const dir = await mkdtemp(path.join(tmpdir(), "preview-entry-"));
	try {
		const entryFile = path.join(dir, "entry.jsx");
		await writeFile(
			entryFile,
			`
import React from "react";
import { createRoot } from "react-dom/client";
import App from "${APP_SPECIFIER}";

const container = document.getElementById("${CONTAINER_ID}");
if (container) {
  createRoot(container).render(React.createElement(App));
}
`,
			"utf8",
		);

		const built = await Bun.build({
			entrypoints: [entryFile],
			target: "browser",
			format: "esm",
			loader: INLINE_ASSET_LOADERS as unknown as NonNullable<Parameters<typeof Bun.build>[0]>["loader"],
			plugins: [appResolverPlugin(appPath), npmPlugin],
		});
		if (!built.success) {
			return { ok: false, code: failureText(undefined, built.logs) };
		}
		const entryOutput =
			built.outputs.find((output) => output.kind === "entry-point") ??
			built.outputs.find((output) => /\.(?:m?js)$/.test(output.path));
		if (!entryOutput) return { ok: false, code: "No build output" };

		const css = (
			await Promise.all(
				built.outputs
					.filter((output) => output.path.endsWith(".css"))
					.map((output) => output.text()),
			)
		)
			.join("\n")
			.trim();

		// CSS 先注入再挂载，避免首帧无样式闪烁
		const code = `${css ? `${bundleStyleScript(scopeCss(css))}\n` : ""}${await entryOutput.text()}`;
		return { ok: true, code };
	} catch (error) {
		// Bun 1.4 的 Bun.build 在失败时抛 AggregateError("Bundle failed")，
		// 真实原因在 error.errors / built.logs 里；只取 message 会得到一句无用日志。
		return { ok: false, code: failureText(error) };
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * 页面级样式：解析页面 HTML 的 `<link rel="stylesheet">` 与 `<style>`（保持文档顺序），
 * 递归内联 `@import`、重写相对 url()、作用域化到 #preview-container。
 *
 * 与交付运行时使用同一份 style.css，不硬编码文件名；页面没有 `<link>` 时回退
 * workspace/style.css（兼容旧模板）。
 */
export async function buildPageStyles(workspace: WorkspaceEntry, rawPage: unknown): Promise<string> {
	const page = parsePageName(rawPage);
	const htmlPath = path.join(workspace.path, `${page}.html`);
	const html = await readFile(htmlPath, "utf8").catch(() => "");
	const urlBase = `/w/${encodeURIComponent(workspace.name)}/`;
	const baseRel = `${page}.html`;
	const seen = new Set<string>();
	const chunks: string[] = [];

	for (const match of html.matchAll(/<link\b[^>]*>|<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		const tag = match[0];
		if (/^<style/i.test(tag)) {
			const inline = rewriteCssUrls(match[1] ?? "", baseRel, urlBase);
			chunks.push(scopeCss(inline));
			continue;
		}
		if (!/\brel\s*=\s*(?:"stylesheet"|'stylesheet'|stylesheet)(?=[\s/>])/i.test(tag)) continue;
		const href = attribute(tag, "href");
		if (!href) continue;
		const file = localWorkspaceFile(workspace, href);
		if (!file) continue;
		const css = await readCssFile(file, workspace, urlBase, seen);
		if (css) chunks.push(scopeCss(css));
	}

	// 兼容旧模板：页面没写 <link> 时仍尝试 workspace/style.css
	if (chunks.length === 0) {
		const css = await readCssFile(path.join(workspace.path, "style.css"), workspace, urlBase, seen);
		if (css) chunks.push(scopeCss(css));
	}

	return chunks.join("\n");
}

/** 读取 CSS 文件并递归内联相对 @import；返回未作用域化、url() 已重写的 CSS */
async function readCssFile(
	fileAbs: string,
	workspace: WorkspaceEntry,
	urlBase: string,
	seen: Set<string>,
): Promise<string> {
	if (seen.has(fileAbs)) return "";
	seen.add(fileAbs);

	const raw = await readFile(fileAbs, "utf8").catch(() => "");
	if (!raw) return "";
	const baseRel = toPosix(path.relative(workspace.path, fileAbs));

	let output = "";
	let cursor = 0;
	const importPattern = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)|"([^"]*)"|'([^']*)')\s*[^;]*;/gi;
	for (const match of raw.matchAll(importPattern)) {
		const at = match.index ?? 0;
		output += raw.slice(cursor, at);
		cursor = at + match[0].length;
		const ref = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "").trim();
		if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(ref)) {
			output += match[0];
			continue;
		}
		const target = path.resolve(path.dirname(fileAbs), decodeURI(ref.split(/[?#]/, 1)[0]));
		if (!isInside(target, workspace.path)) {
			output += match[0];
			continue;
		}
		output += await readCssFile(target, workspace, urlBase, seen);
	}
	output += raw.slice(cursor);

	return rewriteCssUrls(output, baseRel, urlBase);
}

/** bundle 内注入 CSS：同 id 复用，刷新时覆盖而非堆积 */
function bundleStyleScript(css: string): string {
	return `// ---- 预览样式（素材 import 的 CSS，已作用域化） ----
const __previewCss = ${JSON.stringify(css)};
if (__previewCss) {
  let __previewStyle = document.getElementById(${JSON.stringify(BUNDLE_STYLE_ID)});
  if (!__previewStyle) {
    __previewStyle = document.createElement("style");
    __previewStyle.id = ${JSON.stringify(BUNDLE_STYLE_ID)};
    document.head.appendChild(__previewStyle);
  }
  __previewStyle.textContent = __previewCss;
}`;
}

function failureText(error: unknown, logs?: unknown[]): string {
	const errors = (error as { errors?: Array<{ message?: string }> } | null)?.errors;
	if (Array.isArray(errors) && errors.length > 0) {
		return errors.map((item) => item?.message ?? String(item)).join("\n");
	}
	if (logs && logs.length > 0) return logs.map((item) => String(item)).join("\n");
	return error instanceof Error ? error.message : String(error);
}

function attribute(tag: string, name: string): string | undefined {
	const matched = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
	return matched ? (matched[1] ?? matched[2] ?? matched[3]) : undefined;
}

/** 把页面里的 href 解析成 workspace 内的绝对路径；外链 / 绝对路径不处理 */
function localWorkspaceFile(workspace: WorkspaceEntry, href: string): string | undefined {
	const ref = href.trim();
	if (!ref || ref.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("/")) return undefined;
	const target = path.resolve(workspace.path, decodeURI(ref.split(/[?#]/, 1)[0]));
	return isInside(target, workspace.path) ? target : undefined;
}

function isInside(target: string, root: string): boolean {
	const rel = path.relative(root, target);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function toPosix(value: string): string {
	return value.split(path.sep).join("/");
}
