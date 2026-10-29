import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import type { ServerWebSocket } from "bun";
import type { ModelRuntime, ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import type { ErrorCode, FileTree, PageList, WorkspaceList } from "../../shared/protocol.js";
import { createRuntime, type WorkspaceRuntime } from "../runtime.js";
import { buildPageStyles, buildPreview } from "../preview.js";
import { createPage, listPages, PageError, readFileTree, resolvePageEntry } from "../pages.js";
import {
	createWorkspace,
	listWorkspaces,
	resolveWorkspace,
	WorkspaceError,
} from "../workspaces.js";
import { createTransport, type Transport } from "./transport.js";

export interface DesignerServerOptions {
	/** realpath of `PI_WEB_ROOT`; every workspace is one of its direct children. */
	root: string;
	agentDir: string;
	modelRuntime: ModelRuntime;
	trustStore: ProjectTrustStore;
	port: number;
	webDist: string;
}

class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/** One client connection, and therefore one workspace and one runtime. */
interface Connection {
	readonly clientId: string;
	readonly transport: Transport;
	readonly runtime: WorkspaceRuntime;
	readonly controller: AbortController;
	closing?: Promise<void>;
}

interface WsData {
	url: URL;
	clientId: string;
	controller: AbortController;
	transport?: Transport;
	connection?: Connection;
}

export function createDesignerServer(options: DesignerServerOptions): { close(): void } {
	const { root, agentDir, modelRuntime, trustStore, port } = options;
	const webDist = options.webDist;

	/** Latest connection per client instance (browser page). */
	const connections = new Map<string, Connection>();
	/** Every live connection, for shutdown. */
	const live = new Set<Connection>();

	const server = Bun.serve<WsData>({
		port,
		async fetch(req, srv) {
			const url = new URL(req.url);

			// ---- WebSocket 握手 ----
			if (url.pathname === "/ws") {
				const data: WsData = {
					url,
					clientId: url.searchParams.get("clientId") || randomUUID(),
					controller: new AbortController(),
				};
				if (srv.upgrade(req, { data })) return;
				return new Response("WebSocket upgrade failed", { status: 426 });
			}

			try {
				return await handleHttp(req, url);
			} catch (error) {
				const status =
					error instanceof HttpError
						? error.status
						: error instanceof WorkspaceError
							? error.status
							: error instanceof PageError
								? error.status
								: 500;
				return json(status, { error: errorMessage(error), code: errorCode(error) });
			}
		},
		websocket: {
			open(ws: ServerWebSocket<WsData>) {
				void openConnection(ws).catch((error: unknown) => {
					void reportAndClose(ws, error);
				});
			},
			message(ws: ServerWebSocket<WsData>, data) {
				const transport = ws.data.transport;
				if (!transport) return;
				void transport.handleMessage(typeof data === "string" ? data : new TextDecoder().decode(data as Uint8Array)).catch((error: unknown) => {
					transport.sendError("INTERNAL", errorMessage(error));
				});
			},
			close(ws: ServerWebSocket<WsData>) {
				const connection = ws.data.connection;
				if (connection) void closeConnection(connection);
				else ws.data.controller.abort();
			},
		},
	});

	async function reportAndClose(ws: ServerWebSocket<WsData>, error: unknown): Promise<void> {
		try {
			ws.send(
				JSON.stringify({ v: 1, seq: 0, type: "error", code: errorCode(error), message: errorMessage(error) }),
			);
		} catch {
			// The socket died before we could report anything.
		}
		ws.close();
	}

	/**
	 * Resolve the workspace, build the runtime, greet the client, then retire the
	 * previous connection of the same client instance. Building before tearing
	 * down is what makes a failed switch leave the old session untouched.
	 */
	async function openConnection(ws: ServerWebSocket<WsData>): Promise<void> {
		const { url, clientId, controller } = ws.data;
		const transport = createTransport({ ws, signal: controller.signal });
		ws.data.transport = transport;

		let entry;
		try {
			entry = await resolveWorkspace(root, url.searchParams.get("workspace") ?? "");
		} catch (error) {
			transport.sendError(errorCode(error), errorMessage(error));
			await transport.close();
			return;
		}

		if (controller.signal.aborted) return;
		transport.sendHello(entry.name, entry.path);

		let runtime: WorkspaceRuntime;
		try {
			runtime = await createRuntime({
				cwd: entry.path,
				agentDir,
				modelRuntime,
				trustStore,
				signal: controller.signal,
				ui: transport.ui,
				onEvent: (event) => transport.onEvent(event),
				onDiagnostic: (diagnostic) => transport.sendDiagnostic(diagnostic),
				onError: (code, message) => transport.sendError(code, message),
				onShutdownRequest: () => {
					const connection = ws.data.connection;
					if (connection) void closeConnection(connection);
				},
			});
		} catch (error) {
			transport.sendError("WORKSPACE_OPEN_FAILED", errorMessage(error));
			await transport.close();
			return;
		}

		if (controller.signal.aborted) {
			await runtime.dispose();
			return;
		}

		const connection: Connection = { clientId, transport, runtime, controller };
		ws.data.connection = connection;
		transport.attach(runtime);
		transport.sendReady(runtime);

		const previous = connections.get(clientId);
		connections.set(clientId, connection);
		live.add(connection);

		if (previous) await closeConnection(previous);
	}

	/** Idempotent: abort → dispose → close socket, in that order. */
	function closeConnection(connection: Connection): Promise<void> {
		connection.closing ??= (async () => {
			if (connections.get(connection.clientId) === connection) connections.delete(connection.clientId);
			live.delete(connection);

			connection.controller.abort();
			try {
				await connection.runtime.dispose();
			} catch (error) {
				console.error("runtime dispose failed", error);
			}
			await connection.transport.close();
		})();

		return connection.closing;
	}

	async function handleHttp(req: Request, url: URL): Promise<Response> {
		// ---- workspace 列表/创建 ----
		if (url.pathname === "/api/workspaces") {
			if (req.method === "GET") {
				const body: WorkspaceList = { root, workspaces: await listWorkspaces(root) };
				return json(200, body);
			}
			if (req.method === "POST") {
				assertSameOrigin(req);
				const body = await readJsonBody(req);
				const name = typeof body === "object" && body !== null ? (body as { name?: unknown }).name : undefined;
				const entry = await createWorkspace(root, name);
				return json(201, entry);
			}
			return json(405, { error: "Method not allowed" });
		}

		// ---- 页面列表 / 新建页面 ----
		if (url.pathname === "/api/pages") {
			if (req.method === "GET") {
				const workspace = await resolveWorkspace(root, url.searchParams.get("workspace") ?? "");
				const pages = await listPages(workspace);
				const body: PageList = { pages: pages.map((page) => ({ page })) };
				return json(200, body);
			}
			if (req.method === "POST") {
				assertSameOrigin(req);
				const body = await readJsonBody(req);
				const workspaceName =
					typeof body === "object" && body !== null ? (body as { workspace?: unknown }).workspace : undefined;
				const pageName = typeof body === "object" && body !== null ? (body as { page?: unknown }).page : undefined;
				const workspace = await resolveWorkspace(root, workspaceName);
				const page = await createPage(workspace, pageName);
				return json(201, { page });
			}
			return json(405, { error: "Method not allowed" });
		}

		// ---- 文件树（页面 + Components 素材） ----
		if (url.pathname === "/api/files") {
			if (req.method !== "GET") return json(405, { error: "Method not allowed" });
			const workspace = await resolveWorkspace(root, url.searchParams.get("workspace") ?? "");
			const body: FileTree = await readFileTree(workspace);
			return json(200, body);
		}

		// ---- 预览样式（沙盒运行时：交付页面的 <link>/<style> 作用域后注入） ----
		// 必须放在 /preview/ 之前：/preview/styles/<ws>/<page>
		if (url.pathname.startsWith("/preview/styles/")) {
			if (req.method !== "GET") return json(405, { error: "Method not allowed" });
			const [, , , workspaceName, page] = url.pathname.split("/");
			const workspace = await resolveWorkspace(root, decodeURIComponent(workspaceName ?? ""));
			const css = await buildPageStyles(workspace, decodeURIComponent(page ?? ""));
			return new Response(css, {
				headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" },
			});
		}

		// ---- 预览 bundle（沙盒运行时） ----
		if (url.pathname.startsWith("/preview/")) {
			if (req.method !== "GET") return json(405, { error: "Method not allowed" });
			const [, , workspaceName, page] = url.pathname.split("/");
			const workspace = await resolveWorkspace(root, decodeURIComponent(workspaceName ?? ""));
			// 入口存在性先校验，错误时给出明确的页面级提示
			await resolvePageEntry(workspace, decodeURIComponent(page ?? ""));
			const built = await buildPreview(workspace, decodeURIComponent(page ?? ""));
			if (!built.ok) {
				return new Response(built.code, {
					status: 500,
					headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
				});
			}
			return new Response(built.code, {
				headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
			});
		}

		// ---- 工作目录静态服务（交付运行时 window.open 用） ----
		if (url.pathname.startsWith("/w/")) {
			if (req.method !== "GET" && req.method !== "HEAD") {
				return json(405, { error: "Method not allowed" });
			}
			const rest = url.pathname.slice("/w/".length);
			const slash = rest.indexOf("/");
			const workspaceName = decodeURIComponent(slash === -1 ? rest : rest.slice(0, slash));
			const relative = decodeURIComponent(slash === -1 ? "" : rest.slice(slash + 1));
			const workspace = await resolveWorkspace(root, workspaceName);
			const target = resolve(workspace.path, relative);
			if (target !== workspace.path && !isInside(target, workspace.path)) {
				return json(403, { error: "Forbidden" });
			}
			const info = await stat(target).catch(() => undefined);
			const file = info?.isFile() ? target : info?.isDirectory() ? join(target, "index.html") : undefined;
			const fileInfo = file ? await stat(file).catch(() => undefined) : undefined;
			if (!file || !fileInfo?.isFile()) return new Response(`Not found: ${url.pathname}`, { status: 404 });
			return new Response(Bun.file(file), { headers: { "Content-Type": contentType(file) } });
		}

		if (url.pathname === "/ws") return json(426, { error: "WebSocket upgrade required" });
		if (req.method !== "GET" && req.method !== "HEAD") return json(405, { error: "Method not allowed" });

		// ---- 设计器前端静态资源（生产；开发期由 Vite 承担） ----
		return serveFrontend(req, url, webDist);
	}

	return {
		close(): void {
			for (const connection of [...live]) connection.controller.abort();
			server.stop();
		},
	};
}

function isInside(path: string, root: string): boolean {
	const rel = relative(root, path);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function assertSameOrigin(req: Request): void {
	const site = req.headers.get("sec-fetch-site");
	if (site !== null && site !== "same-origin" && site !== "none") {
		throw new HttpError(403, "Cross-origin request rejected");
	}

	const origin = req.headers.get("origin");
	if (origin !== null) {
		let originHost: string | undefined;
		try {
			originHost = new URL(origin).host;
		} catch {
			originHost = undefined;
		}
		const host = req.headers.get("host");
		if (!originHost || !host || originHost !== host) {
			throw new HttpError(403, "Cross-origin request rejected");
		}
	}
}

async function readJsonBody(req: Request): Promise<unknown> {
	const text = await req.text();
	if (text.length > 8 * 1024) throw new HttpError(413, "Request body too large");
	if (!text) return undefined;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new HttpError(400, "Invalid JSON body");
	}
}

async function serveFrontend(req: Request, url: URL, webDist: string): Promise<Response> {
	const indexPath = join(webDist, "index.html");
	const info = await stat(webDist).catch(() => undefined);
	if (!info?.isDirectory() || !(await stat(indexPath).catch(() => undefined))) {
		return new Response(
			`web-dist not found.\n开发期运行 "bun run web"（Vite :5173，已 proxy 到本端口），生产运行 "bun run build" 生成 web-dist。\n`,
			{ status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
		);
	}

	const pathname = decodeURIComponent(url.pathname);
	const requested = resolve(webDist, `.${pathname}`);
	let file: string | undefined;
	if (isInside(requested, webDist)) {
		const requestedInfo = await stat(requested).catch(() => undefined);
		if (requestedInfo?.isFile()) file = requested;
		else if (requestedInfo?.isDirectory()) {
			const index = join(requested, "index.html");
			if ((await stat(index).catch(() => undefined))?.isFile()) file = index;
		}
	}
	// SPA 回退
	file ??= indexPath;

	const fileInfo = await stat(file).catch(() => undefined);
	if (!fileInfo?.isFile()) return new Response("Not found", { status: 404 });

	return new Response(req.method === "HEAD" ? null : Bun.file(file), {
		headers: {
			"Content-Type": contentType(file),
			"Cache-Control": file === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
		},
	});
}

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

function contentType(file: string): string {
	switch (extname(file).toLowerCase()) {
		case ".html":
			return "text/html; charset=utf-8";
		case ".js":
		case ".jsx":
		case ".mjs":
			return "text/javascript; charset=utf-8";
		case ".css":
			return "text/css; charset=utf-8";
		case ".json":
			return "application/json; charset=utf-8";
		case ".svg":
			return "image/svg+xml";
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".gif":
			return "image/gif";
		case ".woff2":
			return "font/woff2";
		case ".map":
			return "application/json; charset=utf-8";
		default:
			return "application/octet-stream";
	}
}

function errorCode(error: unknown): ErrorCode {
	if (error instanceof WorkspaceError) return error.code;
	if (error instanceof PageError) return error.code;
	return "INTERNAL";
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
