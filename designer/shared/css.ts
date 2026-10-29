/**
 * 预览样式处理（沙盒运行时）。
 *
 * 交付运行时的样式来自页面 HTML：
 *   <link rel="stylesheet" href="./style.css" />  → 浏览器按整页（body / :root / 媒体查询）解析
 * 沙盒运行时把 bundle 挂在设计器文档内的 `#preview-container` 上，直接注入整页 CSS 会：
 *   1. 污染设计器自身 UI（body / * / button 等规则）
 *   2. 让页面的媒体查询按“设计器窗口”而不是“预览面板”生效
 *
 * 因此这里做两件事：
 *   - `scopeCss`：把选择器重写到 `#preview-container` 作用域；
 *     `html` / `body` / `:root` → 容器自身（字体、CSS 变量、背景靠继承生效）；
 *     纯宽度 `@media` → `@container`（配合容器的 `container-type: inline-size`，
 *     让预览按面板宽度响应，而不是按设计器窗口宽度）。
 *   - `rewriteCssUrls`：把 `url(...)` 的相对路径按样式表位置解析成 `/w/<ws>/...` 绝对路径。
 *     注入到 `<style>` 后，相对 URL 会以设计器文档为基准，必须提前改写。
 *
 * 只面向页面级全局样式（本项目的 style.css 不使用 CSS 嵌套），不做完整 CSS 解析。
 */
export const PREVIEW_CONTAINER_ID = "preview-container";
export const PREVIEW_SCOPE = `#${PREVIEW_CONTAINER_ID}`;

const NESTED_AT_RULES = /^@(media|supports|layer|container|starting-style)\b/i;
/** 只有宽度条件的媒体查询才能等价换成容器查询（高度需要 size containment）。 */
const WIDTH_MEDIA = /^(\s*)@media\s+(?:only\s+screen\s+and\s+|screen\s+and\s+)?((?:\(\s*(?:min|max)-width\s*:[^)]*\))(?:\s+and\s+(?:\(\s*(?:min|max)-width\s*:[^)]*\)))*)\s*$/i;

export function scopeCss(css: string, scope: string = PREVIEW_SCOPE): string {
	let output = "";
	let index = 0;

	while (index < css.length) {
		const start = index;
		while (index < css.length && /\s/.test(css[index])) index += 1;
		if (index >= css.length) break;

		// 顶层注释原样保留
		if (css.startsWith("/*", index)) {
			const end = css.indexOf("*/", index + 2);
			const next = end === -1 ? css.length : end + 2;
			output += css.slice(start, next);
			index = next;
			continue;
		}

		const scanned = findRuleBoundary(css, index);
		if (scanned.brace === -1) {
			output += css.slice(start);
			break;
		}

		// @import / @charset 等以分号结尾的语句
		if (scanned.semicolon !== -1 && scanned.semicolon < scanned.brace) {
			output += css.slice(start, scanned.semicolon + 1);
			index = scanned.semicolon + 1;
			continue;
		}

		const brace = scanned.brace;
		const close = findMatchingBrace(css, brace);
		if (close === -1) {
			output += css.slice(start);
			break;
		}

		const prelude = css.slice(start, brace);
		const inner = css.slice(brace + 1, close);
		const trimmed = prelude.trimStart();

		if (trimmed.startsWith("@")) {
			output += NESTED_AT_RULES.test(trimmed)
				? `${convertWidthMedia(prelude)}{${scopeCss(inner, scope)}}`
				: css.slice(start, close + 1);
		} else {
			output += `${prefixSelectorList(prelude, scope)}{${inner}}`;
		}

		index = close + 1;
	}

	return output;
}

/**
 * 相对 `url()` 重写：以样式表自身路径 `baseRel`（workspace 相对、POSIX 分隔）为基准，
 * 生成 `/w/<workspace>/<path>` 绝对地址。`data:` / `http:` / `#fragment` / 已绝对路径原样保留。
 */
export function rewriteCssUrls(css: string, baseRel: string, urlBase: string): string {
	const rewrite = (ref: string): string | undefined => {
		const trimmed = ref.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/")) return undefined;
		if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined;
		const resolved = resolveRelativePath(baseRel, trimmed);
		return resolved ? `${urlBase}${encodePath(resolved)}` : undefined;
	};

	// 相对 @import "..."（无 url() 包裹）也要绝对化，否则注入后以设计器文档为基准
	const withImports = css.replace(/@import\s+(?:"([^"]*)"|'([^']*)')/gi, (match, doubleQuoted, singleQuoted) => {
		const absolute = rewrite(String(doubleQuoted ?? singleQuoted ?? ""));
		if (!absolute) return match;
		const quote = doubleQuoted !== undefined ? '"' : "'";
		return `@import ${quote}${absolute}${quote}`;
	});

	return withImports.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi, (match, doubleQuoted, singleQuoted, bare) => {
		const absolute = rewrite(String(doubleQuoted ?? singleQuoted ?? bare ?? ""));
		if (!absolute) return match;
		const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : "";
		return `url(${quote}${absolute}${quote})`;
	});
}

/** POSIX 路径解析；越出 workspace 根（`..`）返回空串 */
function resolveRelativePath(baseRel: string, ref: string): string {
	const clean = ref.split(/[?#]/, 1)[0];
	const baseDir = baseRel.includes("/") ? baseRel.slice(0, baseRel.lastIndexOf("/")) : "";
	const parts: string[] = [];
	for (const segment of `${baseDir}/${clean}`.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			if (parts.length === 0) return "";
			parts.pop();
			continue;
		}
		parts.push(segment);
	}
	return parts.join("/");
}

/** 路径编码：保留 `/` 与已有百分号转义，只处理空格 / # / ? */
function encodePath(relativePath: string): string {
	return encodeURI(relativePath).replace(/#/g, "%23").replace(/\?/g, "%3F");
}

function convertWidthMedia(prelude: string): string {
	const matched = WIDTH_MEDIA.exec(prelude);
	if (!matched) return prelude;
	return `${matched[1]}@container ${matched[2]}`;
}

interface RuleBoundary {
	brace: number;
	semicolon: number;
}

/** 找到当前语句的 `{` 或 `;`（跳过字符串与注释） */
function findRuleBoundary(css: string, from: number): RuleBoundary {
	let quote: string | null = null;
	let inComment = false;

	for (let index = from; index < css.length; index += 1) {
		const char = css[index];
		if (inComment) {
			if (char === "*" && css[index + 1] === "/") {
				inComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === "\\") index += 1;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && css[index + 1] === "*") {
			inComment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "{") return { brace: index, semicolon: -1 };
		if (char === ";") return { brace: -1, semicolon: index };
	}

	return { brace: -1, semicolon: -1 };
}

function findMatchingBrace(css: string, open: number): number {
	let depth = 0;
	let quote: string | null = null;
	let inComment = false;

	for (let index = open; index < css.length; index += 1) {
		const char = css[index];
		if (inComment) {
			if (char === "*" && css[index + 1] === "/") {
				inComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === "\\") index += 1;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && css[index + 1] === "*") {
			inComment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "{") depth += 1;
		if (char === "}") {
			depth -= 1;
			if (depth === 0) return index;
		}
	}

	return -1;
}

function prefixSelectorList(prelude: string, scope: string): string {
	return splitTopLevel(prelude, ",")
		.map((part) => prefixSelector(part, scope))
		.join(",");
}

function prefixSelector(raw: string, scope: string): string {
	const leading = raw.match(/^\s*/)?.[0] ?? "";
	const trailing = raw.match(/\s*$/)?.[0] ?? "";
	const selector = raw.trim();
	if (!selector) return raw;

	// 通配选择器（含伪元素）：容器自身与后代都要重置
	if (/^\*(?::?:?[\w-]+(?:\([^)]*\))?)*$/.test(selector)) {
		return `${leading}${scope}${selector.slice(1)}, ${scope} ${selector}${trailing}`;
	}

	// html / body / :root 的规则迁移到预览容器上；`html body .x` 视为 `#scope .x`
	if (/^(:root|html|body)\b/.test(selector)) {
		const rest = selector.replace(/^(:root|html|body)(?:\s+(?:html|body))?/, "");
		return `${leading}${scope}${rest}${trailing}`;
	}

	if (selector.startsWith(scope)) return raw;
	return `${leading}${scope} ${selector}${trailing}`;
}

/** 按顶层分隔符切分（忽略括号、方括号、字符串、注释内的分隔符） */
function splitTopLevel(input: string, separator: string): string[] {
	const parts: string[] = [];
	let start = 0;
	let depth = 0;
	let quote: string | null = null;
	let inComment = false;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];
		if (inComment) {
			if (char === "*" && input[index + 1] === "/") {
				inComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === "\\") index += 1;
			else if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && input[index + 1] === "*") {
			inComment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "(" || char === "[") depth += 1;
		else if (char === ")" || char === "]") depth -= 1;
		else if (char === separator && depth === 0) {
			parts.push(input.slice(start, index));
			start = index + 1;
		}
	}

	parts.push(input.slice(start));
	return parts;
}
