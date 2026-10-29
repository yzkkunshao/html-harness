import type {
	AgentMessage,
	ClientMessage,
	Diagnostic,
	FileTree,
	ServerMessage,
	SessionState,
	UiResponse,
	WorkspaceEntry,
} from "@shared/protocol";
import {
	createWorkspace as createWorkspaceRequest,
	createPage as createPageRequest,
	listFiles,
	listWorkspaces,
} from "./api";
import { messageRole, messageText } from "./messages";
import { WsClient } from "./ws-client";

export type Connection = "idle" | "connecting" | "open" | "closed";

export interface ToolView {
	toolCallId: string;
	toolName: string;
	args: unknown;
	status: "running" | "done" | "error";
	result?: unknown;
}

export interface UiRequest {
	id: string;
	method: "select" | "confirm" | "input" | "editor";
	payload: Record<string, unknown>;
}

const EMPTY_TREE: FileTree = { pages: [], components: [] };

export interface Snapshot {
	connection: Connection;
	root?: string;
	workspaces: WorkspaceEntry[];
	workspacesError?: string;
	workspace?: string;
	cwd?: string;
	state?: SessionState;
	messages: AgentMessage[];
	streamingText: string;
	thinkingText: string;
	tools: ToolView[];
	queue: { steering: string[]; followUp: string[] };
	uiRequests: UiRequest[];
	diagnostics: Diagnostic[];
	statuses: Record<string, string>;
	editorText: { text: string; nonce: number };
	/** A new connection is being opened; the current one is still alive. */
	switching: boolean;
	lastError?: string;

	// ---- 设计器：文件树 / 预览 / 选中 / Add To Context ----
	/** 左侧文件树（页面 + Components 素材） */
	fileTree: FileTree;
	fileTreeError?: string;
	/** 当前预览的页面（html 名，不含扩展名） */
	activePage?: string;
	/** 手动刷新计数：变更即重新 import 预览 bundle */
	previewNonce: number;
	/** 预览构建失败的错误日志（成功时清除） */
	previewError?: string;
	/** 组件选中开关 */
	selectMode: boolean;
	/** 当前选中组件的 data-fileName */
	selectedFile?: string;
	/** 注入提示词的素材路径 chips */
	chips: string[];
}

const initialState: Snapshot = {
	connection: "idle",
	workspaces: [],
	messages: [],
	streamingText: "",
	thinkingText: "",
	tools: [],
	queue: { steering: [], followUp: [] },
	uiRequests: [],
	diagnostics: [],
	statuses: {},
	editorText: { text: "", nonce: 0 },
	switching: false,
	fileTree: EMPTY_TREE,
	previewNonce: 0,
	selectMode: false,
	chips: [],
};

class SessionStore {
	private snapshot: Snapshot = initialState;
	private readonly listeners = new Set<() => void>();
	/** The connection that owns the visible session. */
	private client?: WsClient;
	/** The connection being opened; it becomes `client` on `ready`. */
	private pending?: { client: WsClient; workspace: string };
	private lastStartRole?: string;
	/** Page-level identity: memory only, a refresh is a new browser instance. */
	private readonly clientId = newClientId();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	readonly getSnapshot = (): Snapshot => this.snapshot;

	async refreshWorkspaces(): Promise<void> {
		try {
			const list = await listWorkspaces();
			this.update({ root: list.root, workspaces: list.workspaces, workspacesError: undefined });
		} catch (error) {
			this.update({ workspacesError: errorMessage(error) });
		}
	}

	/** Creates the directory and refreshes the list. Throws on failure. */
	async createWorkspace(name: string): Promise<WorkspaceEntry> {
		const entry = await createWorkspaceRequest(name);
		await this.refreshWorkspaces();
		return entry;
	}

	/**
	 * Open or switch workspace: always a brand new connection.
	 *
	 * The current connection stays alive until the new one is `ready`, so a
	 * failure leaves the user exactly where they were.
	 */
	openWorkspace(workspace: string): void {
		if (this.pending) return;

		const client = new WsClient(workspace, this.clientId, {
			onMessage: (message) => this.routeMessage(client, message),
			onClose: () => this.handleClose(client),
		});

		this.pending = { client, workspace };
		this.update({
			switching: true,
			lastError: undefined,
			connection: this.client ? this.snapshot.connection : "connecting",
		});
	}

	prompt(text: string, behavior?: "steer" | "followUp"): void {
		this.send({ type: "prompt", text, behavior });
	}

	/**
	 * Add To Context 的发送路径（grilling R3-Q1）：
	 * chips 拼成素材列表注入提示词前缀，用户文本跟在后面；发送后清空 chips。
	 */
	promptWithContext(text: string, behavior?: "steer" | "followUp"): void {
		const chips = this.snapshot.chips;
		const body = text.trim();
		if (chips.length === 0 && body.length === 0) return;

		const header =
			chips.length > 0
				? `请处理以下素材：\n${chips.map((chip) => `- @${chip}`).join("\n")}\n\n`
				: "";
		this.prompt(`${header}${body}`, behavior);
		this.update({ chips: [] });
	}

	abort(): void {
		this.send({ type: "abort" });
	}

	respondUi(id: string, response: UiResponse): void {
		this.send({ type: "ui_response", id, response });
		this.update({ uiRequests: this.snapshot.uiRequests.filter((request) => request.id !== id) });
	}

	// ---------------------------------------------------------------- 设计器

	/** 刷新左侧文件树；activePage 失效时回落到树里第一个 html */
	async refreshFiles(): Promise<void> {
		const workspace = this.snapshot.workspace;
		if (!workspace) return;
		try {
			const tree = await listFiles(workspace);
			if (this.snapshot.workspace !== workspace) return;
			const activePage =
				this.snapshot.activePage && tree.pages.includes(this.snapshot.activePage)
					? this.snapshot.activePage
					: tree.pages[0];
			this.update({
				fileTree: tree,
				fileTreeError: undefined,
				activePage,
				previewError: undefined,
			});
		} catch (error) {
			this.update({ fileTreeError: errorMessage(error) });
		}
	}

	/** 打开页面；点同一个页面等价于刷新预览 */
	openPage(page: string): void {
		if (this.snapshot.activePage === page) {
			this.refreshPreview();
			return;
		}
		this.update({
			activePage: page,
			previewError: undefined,
			selectedFile: undefined,
			previewNonce: this.snapshot.previewNonce + 1,
		});
	}

	/** 手动刷新预览（Q6:B，不做 fs.watch 自动推送） */
	refreshPreview(): void {
		this.update({
			previewError: undefined,
			selectedFile: undefined,
			previewNonce: this.snapshot.previewNonce + 1,
		});
	}

	/** 新建页面并立即打开 */
	async createPage(page: string): Promise<void> {
		const workspace = this.snapshot.workspace;
		if (!workspace) return;
		await createPageRequest(workspace, page);
		await this.refreshFiles();
		this.openPage(page);
	}

	setSelectMode(on: boolean): void {
		this.update({ selectMode: on, selectedFile: on ? this.snapshot.selectedFile : undefined });
	}

	setSelectedFile(file: string | undefined): void {
		this.update({ selectedFile: file });
	}

	setPreviewError(error: string | undefined): void {
		this.update({ previewError: error });
	}

	/** Add To Context：注入一条素材路径（去重） */
	addChip(file: string): void {
		if (this.snapshot.chips.includes(file)) return;
		this.update({ chips: [...this.snapshot.chips, file] });
	}

	removeChip(file: string): void {
		this.update({ chips: this.snapshot.chips.filter((chip) => chip !== file) });
	}

	clearChips(): void {
		this.update({ chips: [] });
	}

	// ---------------------------------------------------------------- 内部

	private send(message: ClientMessage): void {
		this.client?.send(message);
	}

	private update(patch: Partial<Snapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		for (const listener of this.listeners) listener();
	}

	private patchState(patch: Partial<SessionState>): void {
		if (!this.snapshot.state) return;
		this.update({ state: { ...this.snapshot.state, ...patch } });
	}

	private appendDiagnostic(diagnostic: Diagnostic): void {
		this.update({ diagnostics: [...this.snapshot.diagnostics.slice(-99), diagnostic] });
	}

	private routeMessage(client: WsClient, message: ServerMessage): void {
		if (this.pending?.client === client) {
			this.handlePending(client, message);
			return;
		}
		if (this.client !== client) return;
		this.handle(message);
	}

	/** Frames of a connection that has not been promoted yet. */
	private handlePending(client: WsClient, message: ServerMessage): void {
		const pending = this.pending;
		if (!pending || pending.client !== client) return;

		if (message.type === "error") {
			this.pending = undefined;
			client.close();
			this.update({
				switching: false,
				lastError: `${message.code}: ${message.message}`,
				connection: this.client ? this.snapshot.connection : "closed",
			});
			this.appendDiagnostic({
				type: "error",
				message: `Cannot open "${pending.workspace}": ${message.code}: ${message.message}`,
			});
			return;
		}

		if (message.type !== "ready") return;

		const previous = this.client;
		this.pending = undefined;
		this.client = client;
		this.lastStartRole = undefined;

		this.update({
			connection: "open",
			switching: false,
			workspace: pending.workspace,
			cwd: message.state.cwd,
			state: message.state,
			messages: message.messages,
			streamingText: "",
			thinkingText: "",
			tools: [],
			queue: { steering: [], followUp: [] },
			uiRequests: [],
			diagnostics: [],
			statuses: {},
			lastError: undefined,
			// 新工作目录：清空设计器状态，随后拉取文件树
			fileTree: EMPTY_TREE,
			fileTreeError: undefined,
			activePage: undefined,
			previewError: undefined,
			selectedFile: undefined,
			chips: [],
		});

		// Only now is the old workspace's connection and runtime retired.
		previous?.close();
		void this.refreshFiles();
	}

	private handleClose(client: WsClient): void {
		if (this.pending?.client === client) {
			this.pending = undefined;
			this.update({
				switching: false,
				connection: this.client ? this.snapshot.connection : "closed",
			});
			return;
		}

		if (this.client !== client) return;
		this.client = undefined;
		this.update({ connection: "closed" });
	}

	private handle(message: ServerMessage): void {
		switch (message.type) {
			case "hello": {
				this.update({ workspace: message.workspace, cwd: message.cwd });
				return;
			}

			case "ready": {
				this.lastStartRole = undefined;
				this.update({
					connection: "open",
					cwd: message.state.cwd,
					state: message.state,
					messages: message.messages,
					streamingText: "",
					thinkingText: "",
					tools: [],
					queue: { steering: [], followUp: [] },
					uiRequests: [],
					diagnostics: [],
					statuses: {},
				});
				void this.refreshFiles();
				return;
			}

			case "event": {
				this.handleEvent(message.event);
				return;
			}

			case "queue": {
				this.update({ queue: { steering: message.steering, followUp: message.followUp } });
				return;
			}

			case "ui_request": {
				this.handleUiRequest(message.id, message.method, message.payload);
				return;
			}

			case "diagnostic": {
				this.appendDiagnostic(message.diagnostic);
				return;
			}

			case "error": {
				this.update({ lastError: `${message.code}: ${message.message}` });
				this.appendDiagnostic({ type: "error", message: `${message.code}: ${message.message}` });
				return;
			}

			case "pong":
				return;
		}
	}

	private handleEvent(event: Extract<ServerMessage, { type: "event" }>["event"]): void {
		switch (event.type) {
			case "message_start": {
				this.lastStartRole = messageRole(event.message);
				this.update({ messages: [...this.snapshot.messages, event.message] });
				if (messageRole(event.message) === "assistant") {
					this.update({ streamingText: messageText(event.message), thinkingText: "" });
				}
				return;
			}

			case "message_update": {
				const delta = event.assistantMessageEvent;
				if (delta.type === "text_delta" && "delta" in delta) {
					this.update({ streamingText: this.snapshot.streamingText + delta.delta });
				} else if (delta.type === "thinking_delta" && "delta" in delta) {
					this.update({ thinkingText: this.snapshot.thinkingText + delta.delta });
				}
				return;
			}

			case "message_end": {
				const role = messageRole(event.message);
				const messages = [...this.snapshot.messages];

				if (this.lastStartRole === role && messages.length > 0) {
					messages[messages.length - 1] = event.message;
				} else {
					messages.push(event.message);
				}
				this.lastStartRole = undefined;

				this.update({
					messages,
					streamingText: role === "assistant" ? "" : this.snapshot.streamingText,
					thinkingText: role === "assistant" ? "" : this.snapshot.thinkingText,
				});
				return;
			}

			case "tool_execution_start": {
				this.update({
					tools: [
						...this.snapshot.tools,
						{
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							args: event.args,
							status: "running",
						},
					],
				});
				return;
			}

			case "tool_execution_end": {
				this.update({
					tools: this.snapshot.tools.map((tool) =>
						tool.toolCallId === event.toolCallId
							? { ...tool, status: event.isError ? "error" : "done", result: event.result }
							: tool,
					),
				});
				return;
			}

			case "agent_start": {
				this.patchState({ isStreaming: true });
				return;
			}

			case "agent_settled": {
				this.patchState({ isStreaming: false });
				this.update({ streamingText: "", thinkingText: "" });
				return;
			}

			case "auto_retry_start": {
				this.appendDiagnostic({
					type: "warning",
					message: `Retrying (${event.attempt}/${event.maxAttempts}) in ${event.delayMs}ms: ${event.errorMessage}`,
				});
				return;
			}

			case "auto_retry_end": {
				this.appendDiagnostic({
					type: event.success ? "info" : "error",
					message: event.success ? "Retry succeeded" : "Retry failed",
				});
				return;
			}

			case "compaction_start": {
				this.appendDiagnostic({ type: "info", message: `Compaction started (${event.reason})` });
				return;
			}

			case "compaction_end": {
				this.appendDiagnostic({
					type: event.errorMessage ? "error" : "info",
					message: event.errorMessage ?? `Compaction finished (${event.reason})`,
				});
				return;
			}

			default:
				return;
		}
	}

	private handleUiRequest(id: string, method: string, payload: Record<string, unknown>): void {
		switch (method) {
			case "notify": {
				const type = payload.notifyType === "warning" || payload.notifyType === "error" ? payload.notifyType : "info";
				this.appendDiagnostic({ type, message: String(payload.message ?? "") });
				return;
			}
			case "setStatus": {
				const key = String(payload.key ?? "");
				const text = payload.text == null ? "" : String(payload.text);
				const statuses = { ...this.snapshot.statuses };
				if (text) statuses[key] = text;
				else delete statuses[key];
				this.update({ statuses });
				return;
			}
			case "setTitle": {
				document.title = String(payload.title ?? "pi 页面设计器");
				return;
			}
			case "set_editor_text": {
				this.update({
					editorText: { text: String(payload.text ?? ""), nonce: this.snapshot.editorText.nonce + 1 },
				});
				return;
			}
			case "select":
			case "confirm":
			case "input":
			case "editor": {
				this.update({
					uiRequests: [...this.snapshot.uiRequests, { id, method, payload }],
				});
				return;
			}
			default:
				return;
		}
	}
}

function newClientId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `client-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export const store = new SessionStore();
