import { useCallback, useEffect, useRef, useState } from "react";
import { store, type Snapshot } from "../store";

/**
 * 预览面板（沙盒运行时，同文档渲染）。
 *
 * 加载：fetch `/preview/<ws>/<page>?t=` → blob URL → import()。bundle 自带 React 与
 * 挂载代码，挂到固定的 `#preview-container`；设计器自己的 React 不参与预览渲染。
 *
 * 选中（grilling R2-Q2:A）：开关打开后 hover 高亮、单击选中，浮层提供
 * Add To Context —— 路径来自素材根节点的 `data-fileName`。
 */
export function PreviewPane({ snapshot }: { snapshot: Snapshot }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const selectedRef = useRef<HTMLElement | null>(null);
	const [menu, setMenu] = useState<{ file: string; top: number; left: number }>();
	const [loading, setLoading] = useState(false);
	const [newPage, setNewPage] = useState("");
	const [creating, setCreating] = useState(false);

	const workspace = snapshot.workspace;
	const page = snapshot.activePage;

	// ---- 加载 / 刷新预览 bundle ----
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !workspace || !page) return;

		let cancelled = false;
		let styleEl: HTMLStyleElement | undefined;
		container.innerHTML = "";
		selectedRef.current = null;
		setMenu(undefined);
		setLoading(true);

		const url = `/preview/${encodeURIComponent(workspace)}/${encodeURIComponent(page)}?t=${snapshot.previewNonce}`;
		// 页面级样式：服务端解析交付页面 HTML 的 <link>/<style>，内联 @import、
		// 重写 url() 后按 #preview-container 作用域返回（与 bundle 并行拉取）
		const stylesUrl = `/preview/styles/${encodeURIComponent(workspace)}/${encodeURIComponent(page)}?t=${snapshot.previewNonce}`;
		void (async () => {
			try {
				const [response, css] = await Promise.all([
					fetch(url, { cache: "no-store" }),
					fetch(stylesUrl, { cache: "no-store" })
						.then((result) => (result.ok ? result.text() : ""))
						.catch(() => ""),
				]);
				if (cancelled) return;

				if (css.trim()) {
					styleEl = document.createElement("style");
					styleEl.id = "preview-page-style";
					styleEl.dataset.previewStyle = workspace;
					styleEl.textContent = css;
					document.head.appendChild(styleEl);
				}

				const body = await response.text();
				if (cancelled) return;
				if (!response.ok) {
					store.setPreviewError(body);
					return;
				}
				store.setPreviewError(undefined);
				const blobUrl = URL.createObjectURL(new Blob([body], { type: "text/javascript" }));
				try {
					await import(/* @vite-ignore */ blobUrl);
				} finally {
					URL.revokeObjectURL(blobUrl);
				}
			} catch (error) {
				if (!cancelled) store.setPreviewError(errorText(error));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			styleEl?.remove();
			// bundle 内注入的 CSS（素材 import 的 .css）
			document.getElementById("preview-bundle-style")?.remove();
		};
	}, [workspace, page, snapshot.previewNonce]);

	// ---- 组件选中（hover 高亮 + 单击选中） ----
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		if (!snapshot.selectMode) {
			selectedRef.current?.classList.remove("ctx-selected");
			selectedRef.current = null;
			setMenu(undefined);
			return;
		}

		let hovered: HTMLElement | null = null;

		const targetOf = (event: Event): HTMLElement | null => {
			const node = event.target;
			if (!(node instanceof Element)) return null;
			return node.closest("[data-fileName]");
		};

		const onOver = (event: Event): void => {
			const el = targetOf(event);
			if (el === hovered) return;
			hovered?.classList.remove("ctx-hover");
			hovered = el;
			hovered?.classList.add("ctx-hover");
		};

		const onOut = (event: Event): void => {
			if (!hovered) return;
			if (event.target !== hovered && hovered.contains(event.target as Node)) return;
			hovered.classList.remove("ctx-hover");
			hovered = null;
		};

		const onClick = (event: Event): void => {
			// 选中模式下吞掉页面自身的点击行为（链接、按钮等）
			event.preventDefault();
			event.stopPropagation();

			const el = targetOf(event);
			selectedRef.current?.classList.remove("ctx-selected");

			if (!el) {
				selectedRef.current = null;
				store.setSelectedFile(undefined);
				setMenu(undefined);
				return;
			}

			selectedRef.current = el;
			el.classList.add("ctx-selected");
			const file = el.getAttribute("data-fileName") ?? "";
			store.setSelectedFile(file);
			const rect = el.getBoundingClientRect();
			setMenu({ file, top: rect.bottom + 6, left: rect.left });
		};

		container.addEventListener("mouseover", onOver, true);
		container.addEventListener("mouseout", onOut, true);
		container.addEventListener("click", onClick, true);

		return () => {
			container.removeEventListener("mouseover", onOver, true);
			container.removeEventListener("mouseout", onOut, true);
			container.removeEventListener("click", onClick, true);
			hovered?.classList.remove("ctx-hover");
			selectedRef.current?.classList.remove("ctx-selected");
		};
	}, [snapshot.selectMode, snapshot.previewNonce, snapshot.activePage]);

	const addToContext = useCallback((file: string) => {
		store.addChip(file);
		selectedRef.current?.classList.remove("ctx-selected");
		selectedRef.current = null;
		store.setSelectedFile(undefined);
		setMenu(undefined);
	}, []);

	async function submitNewPage(): Promise<void> {
		const name = newPage.trim();
		if (!name || creating) return;
		setCreating(true);
		try {
			await store.createPage(name);
			setNewPage("");
		} catch (error) {
			store.setPreviewError(errorText(error));
		} finally {
			setCreating(false);
		}
	}

	const deliverableUrl = workspace && page ? `/w/${encodeURIComponent(workspace)}/${encodeURIComponent(page)}.html` : undefined;

	return (
		<section className="preview-pane">
			<header className="preview-toolbar">
				<span className="preview-page" title={snapshot.cwd}>
					{page ? `${page}.html` : "no page"}
				</span>

				<div className="preview-tools">
					<form
						className="newpage-form"
						onSubmit={(event) => {
							event.preventDefault();
							void submitNewPage();
						}}
					>
						<input
							className="newpage-input"
							value={newPage}
							onChange={(event) => setNewPage(event.target.value)}
							placeholder="new page"
							spellCheck={false}
							disabled={creating}
						/>
						<button type="submit" className="button button-ghost button-small" disabled={creating || !newPage.trim()}>
							+ 页面
						</button>
					</form>

					<label className={`select-toggle${snapshot.selectMode ? " select-toggle-on" : ""}`} title="组件选中开关">
						<input
							type="checkbox"
							checked={snapshot.selectMode}
							onChange={(event) => store.setSelectMode(event.target.checked)}
						/>
						组件选中
					</label>

					<button
						type="button"
						className="button button-ghost button-small"
						onClick={() => store.refreshPreview()}
						disabled={!page || loading}
						title="重新打包并刷新预览"
					>
						{loading ? "构建中…" : "刷新"}
					</button>

					<button
						type="button"
						className="button button-ghost button-small"
						onClick={() => deliverableUrl && window.open(deliverableUrl, "_blank", "noopener")}
						disabled={!deliverableUrl}
						title="在交付运行时（esm-x）打开页面"
					>
						交付物 ↗
					</button>
				</div>
			</header>

			{snapshot.previewError ? (
				<div className="preview-error">
					<div className="preview-error-head">
						<span>预览构建失败</span>
						<button type="button" className="button button-small" onClick={() => store.refreshPreview()}>
							重试
						</button>
					</div>
					<pre>{snapshot.previewError}</pre>
				</div>
			) : !page ? (
				<div className="preview-empty">
					<p>选择左侧页面开始预览。</p>
					<p className="preview-empty-hint">没有页面？用上方输入框新建一个（自动生成模板）。</p>
				</div>
			) : null}

			{/* 预览挂载点：import 的 bundle 会把自己挂到这里，React 不重渲染其内部 */}
			<div className={`preview-stage${snapshot.selectMode ? " preview-stage-selecting" : ""}`}>
				<div id="preview-container" ref={containerRef} />
			</div>

			{menu && snapshot.selectMode && (
				<div
					className="selection-menu"
					style={{ top: menu.top, left: menu.left }}
					onMouseDown={(event) => event.stopPropagation()}
				>
					<span className="selection-file" title={menu.file}>
						{menu.file}
					</span>
					<button type="button" className="button button-small" onClick={() => addToContext(menu.file)}>
						Add To Context
					</button>
				</div>
			)}
		</section>
	);
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
