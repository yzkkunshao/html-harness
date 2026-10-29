import { useState, useSyncExternalStore } from "react";
import { Composer } from "./components/Composer";
import { DiagnosticsBar } from "./components/DiagnosticsBar";
import { ExtensionDialog } from "./components/ExtensionDialog";
import { FileTree } from "./components/FileTree";
import { PreviewPane } from "./components/PreviewPane";
import { StatusBar } from "./components/StatusBar";
import { Transcript } from "./components/Transcript";
import { WorkspaceList } from "./components/WorkspaceList";
import { store } from "./store";

/**
 * 布局（grilling Q8）：左侧大窗口 = 文件树 + 预览；右侧固定对话栏（VS Code chat 风格）。
 */
export function App() {
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
	const [pickerOpen, setPickerOpen] = useState(false);

	// No session yet: the workspace list is the entry point.
	if (!snapshot.state) {
		return (
			<div className="landing">
				<WorkspaceList snapshot={snapshot} />
			</div>
		);
	}

	return (
		<div className="app designer">
			<header className="topbar">
				<div className="brand">
					<span className="brand-mark">π</span>
					<span>页面设计器</span>
				</div>
				<button
					type="button"
					className="workspace-button"
					onClick={() => setPickerOpen(true)}
					title={snapshot.cwd}
					disabled={snapshot.switching}
				>
					<span className="workspace-icon">▣</span>
					<span className="workspace-name">{snapshot.workspace ?? "(workspace)"}</span>
					<span className="workspace-switch">switch</span>
				</button>
				{snapshot.connection !== "open" && (
					<span className={`connection connection-${snapshot.connection}`}>
						{snapshot.connection === "connecting" ? "Opening workspace…" : "Disconnected"}
					</span>
				)}
			</header>

			<div className="workbench">
				<div className="workbench-main">
					<FileTree snapshot={snapshot} />
					<PreviewPane snapshot={snapshot} />
				</div>

				<aside className="chat-sidebar">
					<div className="chat-head">
						<span className="chat-title">Agent</span>
						<StatusBar snapshot={snapshot} />
					</div>
					<DiagnosticsBar diagnostics={snapshot.diagnostics} />
					<Transcript snapshot={snapshot} />
					<Composer snapshot={snapshot} />
				</aside>
			</div>

			<ExtensionDialog requests={snapshot.uiRequests} />

			{pickerOpen && (
				<div className="modal-backdrop">
					<WorkspaceList snapshot={snapshot} onClose={() => setPickerOpen(false)} />
				</div>
			)}
		</div>
	);
}
