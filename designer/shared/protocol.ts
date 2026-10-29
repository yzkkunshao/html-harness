/**
 * Wire protocol shared by the Bun server and the browser.
 *
 * Every pi import here MUST be `import type`: pi must never enter the browser
 * bundle..pi 能力（read/write/edit/bash 等全部工具）不做任何裁剪，全量开放。
 */
import type { AgentSession, JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";

/** A pi message exactly as `AgentSession.messages` exposes it. */
export type AgentMessage = AgentSession["messages"][number];
export type ThinkingLevel = AgentSession["thinkingLevel"];
export type PromptImages = NonNullable<NonNullable<Parameters<AgentSession["prompt"]>[1]>["images"]>;
export type WireEvent = JsonAgentSessionEvent;
export type Diagnostic = { type: "info" | "warning" | "error"; message: string };

export type ErrorCode =
	| "BAD_REQUEST"
	| "BAD_WORKSPACE_NAME"
	| "WORKSPACE_NOT_FOUND"
	| "WORKSPACE_EXISTS"
	| "FORBIDDEN_PATH"
	| "FORBIDDEN_ORIGIN"
	| "WORKSPACE_OPEN_FAILED"
	| "PROMPT_REJECTED"
	| "NO_MODEL"
	| "PAGE_NOT_FOUND"
	| "BAD_PAGE_NAME"
	| "PAGE_EXISTS"
	| "TEMPLATE_MISSING"
	| "INTERNAL";

export interface SessionState {
	cwd: string;
	model?: { provider: string; id: string; name?: string };
	thinkingLevel: ThinkingLevel;
	isStreaming: boolean;
	sessionId: string;
	sessionFile?: string;
	messageCount: number;
}

export type UiMethod =
	| "select"
	| "confirm"
	| "input"
	| "editor"
	| "notify"
	| "setStatus"
	| "setTitle"
	| "set_editor_text";

/** Response to a dialog `ui_request`. Fire-and-forget methods never get one. */
export interface UiResponse {
	value?: string;
	confirmed?: boolean;
	cancelled?: boolean;
}

/**
 * Connection-scoped framing. One connection is one workspace is one session.
 */
export interface Envelope {
	v: 1;
	seq: number;
}

export type ClientMessage =
	| { type: "prompt"; text: string; images?: PromptImages; behavior?: "steer" | "followUp" }
	| { type: "steer"; text: string }
	| { type: "follow_up"; text: string }
	| { type: "abort" }
	| { type: "ui_response"; id: string; response: UiResponse }
	| { type: "ping" };

export type ServerMessage =
	| (Envelope & { type: "hello"; workspace: string; cwd: string })
	| (Envelope & { type: "ready"; state: SessionState; messages: AgentMessage[]; sessionFile?: string })
	| (Envelope & { type: "event"; event: WireEvent })
	| (Envelope & { type: "queue"; steering: string[]; followUp: string[] })
	| (Envelope & {
			type: "ui_request";
			id: string;
			method: UiMethod;
			payload: Record<string, unknown>;
	  })
	| (Envelope & { type: "diagnostic"; diagnostic: Diagnostic })
	| (Envelope & { type: "error"; code: ErrorCode; message: string })
	| (Envelope & { type: "pong" });

/** A workspace is a direct child directory of the server's root. */
export interface WorkspaceEntry {
	name: string;
	path: string;
}

export interface WorkspaceList {
	root: string;
	workspaces: WorkspaceEntry[];
}

/** 页面 = workspace 根下的一个 *.html；entry 为同名入口 jsx（index → App.jsx 特例）。 */
export interface PageEntry {
	/** html 文件名（不含扩展名），如 "index" */
	page: string;
}

export interface PageList {
	pages: PageEntry[];
}

/** 左侧文件树：页面节点 + Components/ 下的素材节点。 */
export interface FileTree {
	pages: string[];
	components: string[];
}
