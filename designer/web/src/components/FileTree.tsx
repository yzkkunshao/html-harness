import { useState, type MouseEvent } from "react";
import { store, type Snapshot } from "../store";

/**
 * 左侧文件树（grilling 最后一轮 Q1:A）：
 * - 页面节点：workspace 根下 *.html，点击打开预览
 * - 素材节点：Components/*.jsx，首期点击无操作，右键 Add To Context
 * - 其他文件（vendor/、style.css 等）不展示
 */
export function FileTree({ snapshot }: { snapshot: Snapshot }) {
	const [menu, setMenu] = useState<{ file: string; x: number; y: number }>();
	const { pages, components } = snapshot.fileTree;

	function onComponentContextMenu(event: MouseEvent, file: string): void {
		event.preventDefault();
		setMenu({ file, x: event.clientX, y: event.clientY });
	}

	return (
		<nav className="filetree" onClick={() => setMenu(undefined)}>
			<div className="filetree-title">文件</div>

			<div className="filetree-group">
				<div className="filetree-group-title">页面</div>
				{pages.length === 0 && <div className="filetree-empty">暂无页面</div>}
				{pages.map((page) => {
					const file = `${page}.html`;
					const active = snapshot.activePage === page;
					return (
						<button
							type="button"
							key={file}
							className={`filetree-item${active ? " filetree-item-active" : ""}`}
							title={`/${snapshot.workspace}/${file}`}
							onClick={() => store.openPage(page)}
						>
							<span className="filetree-icon">▤</span>
							{file}
						</button>
					);
				})}
			</div>

			<div className="filetree-group">
				<div className="filetree-group-title">素材</div>
				{components.length === 0 && <div className="filetree-empty">Components/ 为空</div>}
				{components.map((file) => (
					<button
						type="button"
						key={file}
						className="filetree-item"
						title={`${file}（右键 Add To Context）`}
						onContextMenu={(event) => onComponentContextMenu(event, file)}
					>
						<span className="filetree-icon">◈</span>
						{file.split("/").at(-1)}
					</button>
				))}
			</div>

			{snapshot.fileTreeError && <div className="filetree-error">{snapshot.fileTreeError}</div>}

			{menu && (
				<div className="contextmenu" style={{ left: menu.x, top: menu.y }}>
					<button
						type="button"
						className="contextmenu-item"
						onClick={() => {
							store.addChip(menu.file);
							setMenu(undefined);
						}}
					>
						Add To Context
					</button>
				</div>
			)}
		</nav>
	);
}
