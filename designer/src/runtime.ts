import {
	type AgentSession,
	type AgentSessionEvent,
	type AgentSessionServices,
	createAgentSession,
	type ExtensionUIContext,
	type ModelRuntime,
	type ProjectTrustStore,
	resolveModelScopeWithDiagnostics,
	SessionManager,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import type {
	AgentMessage,
	Diagnostic,
	ErrorCode,
	PromptImages,
	SessionState,
	UiMethod,
	UiResponse,
} from "../shared/protocol.js";
import { createCwdServices } from "./services.js";

/**
 * The only pi-facing surface L2 exposes to L3/L4. L4 never sees an
 * `ExtensionUIContext`; L3 never sees an `AgentSession`.
 */
export interface UiPort {
	/** Resolves `undefined` on cancel / timeout / abort. Never rejects. */
	request(
		method: UiMethod,
		payload: Record<string, unknown>,
		options?: { signal?: AbortSignal; timeout?: number },
	): Promise<UiResponse | undefined>;
	notify(message: string, level?: "info" | "warning" | "error"): void;
	setStatus(key: string, text: string | undefined): void;
	setTitle(title: string): void;
	setEditorText(text: string): void;
	/** Resolve every pending dialog with its fallback. */
	closeAll(): void;
}

export interface CreateRuntimeOptions {
	/** Already validated by L4: a realpath directly under the server root. */
	cwd: string;
	agentDir: string;
	modelRuntime: ModelRuntime;
	trustStore: ProjectTrustStore;
	/** Owned by L4. Aborting it is the single cancel entry point. */
	signal: AbortSignal;
	ui: UiPort;
	onEvent: (event: AgentSessionEvent) => void;
	onDiagnostic: (diagnostic: Diagnostic) => void;
	onError: (code: ErrorCode, message: string) => void;
	/** Extension called `ctx.shutdown()`; L4 decides what teardown means. */
	onShutdownRequest: () => void;
}

export interface WorkspaceRuntime {
	readonly cwd: string;
	/** Diagnostics collected while building this workspace (config, model scope). */
	readonly diagnostics: Diagnostic[];
	readState(): SessionState;
	readMessages(): AgentMessage[];
	prompt(text: string, options?: { images?: PromptImages; behavior?: "steer" | "followUp" }): void;
	steer(text: string): Promise<void>;
	followUp(text: string): Promise<void>;
	/** The UI's Stop button. Teardown uses `signal` instead. */
	abort(): Promise<void>;
	/**
	 * Wait for the agent to settle, then release the session.
	 *
	 * No `switchCwd`, no generations: the runtime is created for one directory
	 * and thrown away with the connection that owns it.
	 */
	dispose(): Promise<void>;
}

type ExtensionBindings = Parameters<AgentSession["bindExtensions"]>[0];

const DISPOSE_TIMEOUT_MS = 5_000;

export async function createRuntime(options: CreateRuntimeOptions): Promise<WorkspaceRuntime> {
	const services: AgentSessionServices = await createCwdServices({
		cwd: options.cwd,
		agentDir: options.agentDir,
		modelRuntime: options.modelRuntime,
		trustStore: options.trustStore,
	});

	const scope = await resolveModelScopeWithDiagnostics(
		services.settingsManager.getEnabledModels() ?? [],
		options.modelRuntime,
	);

	const diagnostics: Diagnostic[] = [
		...services.diagnostics,
		...scope.diagnostics.map((diagnostic) => ({ type: "warning" as const, message: diagnostic.message })),
	];

	const { session, modelFallbackMessage } = await createAgentSession({
		cwd: services.cwd,
		agentDir: services.agentDir,
		modelRuntime: services.modelRuntime,
		settingsManager: services.settingsManager,
		resourceLoader: services.resourceLoader,
		sessionManager: SessionManager.create(services.cwd),
		scopedModels: scope.scopedModels,
		sessionStartEvent: { type: "session_start", reason: "startup" },
	});

	if (modelFallbackMessage) diagnostics.push({ type: "warning", message: modelFallbackMessage });

	const unsubscribe = session.subscribe((event) => {
		if (options.signal.aborted) return;
		options.onEvent(event);
	});

	try {
		await session.bindExtensions(toBindings(session, options));
	} catch (error) {
		options.onDiagnostic({ type: "error", message: `Extension bind failed: ${errorMessage(error)}` });
	}

	const onAbort = (): void => {
		void session.abort();
	};
	if (options.signal.aborted) onAbort();
	else options.signal.addEventListener("abort", onAbort, { once: true });

	let disposed = false;

	return {
		cwd: services.cwd,
		diagnostics,

		readState(): SessionState {
			return sessionState(session);
		},

		readMessages(): AgentMessage[] {
			return session.messages;
		},

		prompt(text, promptOptions): void {
			if (options.signal.aborted) return;

			let accepted = false;
			void session
				.prompt(text, {
					source: "rpc",
					images: promptOptions?.images,
					streamingBehavior: session.isStreaming ? (promptOptions?.behavior ?? "steer") : undefined,
					preflightResult: () => {
						accepted = true;
					},
				})
				.catch((error: unknown) => {
					options.onError(accepted ? "INTERNAL" : "PROMPT_REJECTED", errorMessage(error));
				});
		},

		async steer(text: string): Promise<void> {
			await session.steer(text, undefined, { source: "rpc" });
		},

		async followUp(text: string): Promise<void> {
			await session.followUp(text, undefined, { source: "rpc" });
		},

		async abort(): Promise<void> {
			await session.abort();
		},

		async dispose(): Promise<void> {
			if (disposed) return;
			disposed = true;

			options.signal.removeEventListener("abort", onAbort);
			unsubscribe();
			options.ui.closeAll();

			try {
				await withTimeout(session.waitForIdle(), DISPOSE_TIMEOUT_MS);
			} catch {
				options.onDiagnostic({
					type: "warning",
					message: `Agent did not settle within ${DISPOSE_TIMEOUT_MS}ms; disposing anyway.`,
				});
			}

			session.dispose();
		},
	};
}

/**
 * pi-typed bindings live here and only here. `signal` is not part of the
 * bindings: abort reaches the session through the listener installed above.
 */
function toBindings(session: AgentSession, options: CreateRuntimeOptions): ExtensionBindings {
	return {
		uiContext: toExtensionUIContext(options.ui),
		mode: "rpc",
		abortHandler: () => {
			void session.abort();
		},
		shutdownHandler: () => options.onShutdownRequest(),
		onError: (error) => {
			options.onDiagnostic({
				type: "error",
				message: `Extension "${error.extensionPath}" (${error.event}): ${error.error}`,
			});
		},
		commandContextActions: {
			waitForIdle: () => session.waitForIdle(),
			newSession: async () => ({ cancelled: true }),
			fork: async () => ({ cancelled: true }),
			switchSession: async () => ({ cancelled: true }),
			navigateTree: async (targetId, navigateOptions) => {
				const result = await session.navigateTree(targetId, {
					summarize: navigateOptions?.summarize,
					customInstructions: navigateOptions?.customInstructions,
					replaceInstructions: navigateOptions?.replaceInstructions,
					label: navigateOptions?.label,
				});
				return { cancelled: result.cancelled };
			},
			reload: async () => {
				await session.reload();
			},
		},
	};
}

function toExtensionUIContext(ui: UiPort): ExtensionUIContext {
	let editorText = "";

	const context: ExtensionUIContext = {
		select: async (title, choices, options) =>
			(await ui.request("select", { title, options: choices, timeout: options?.timeout }, options))?.value,
		confirm: async (title, message, options) =>
			(await ui.request("confirm", { title, message, timeout: options?.timeout }, options))?.confirmed ?? false,
		input: async (title, placeholder, options) =>
			(await ui.request("input", { title, placeholder, timeout: options?.timeout }, options))?.value,
		editor: async (title, prefill) => (await ui.request("editor", { title, prefill }))?.value,

		notify: (message, type) => ui.notify(message, type ?? "info"),
		setStatus: (key, text) => ui.setStatus(key, text ?? undefined),
		setTitle: (title) => ui.setTitle(title),

		pasteToEditor: (text) => context.setEditorText(text),
		setEditorText: (text) => {
			editorText = text;
			ui.setEditorText(text);
		},
		getEditorText: () => editorText,

		onTerminalInput: () => () => {},
		setWorkingMessage: () => {},
		setWorkingVisible: () => {},
		setWorkingIndicator: () => {},
		setHiddenThinkingLabel: () => {},
		setWidget: () => {},
		setFooter: () => {},
		setHeader: () => {},
		custom: async <T,>() => undefined as T,
		addAutocompleteProvider: () => {},
		setEditorComponent: () => {},
		getEditorComponent: () => undefined,

		get theme() {
			return theme;
		},
		getAllThemes: () => [],
		getTheme: () => undefined,
		setTheme: (_theme: string | Theme) => ({ success: false, error: "Theme switching is not supported in web mode" }),
		getToolsExpanded: () => false,
		setToolsExpanded: () => {},
	};

	return context;
}

/** The web has no terminal: colors are pass-through strings. */
const theme = {
	fg: (_color: unknown, text: string) => text,
	bg: (_color: unknown, text: string) => text,
	bold: (text: string) => text,
	italic: (text: string) => text,
	underline: (text: string) => text,
	inverse: (text: string) => text,
	strikethrough: (text: string) => text,
	style: (text: string) => text,
	getFgAnsi: () => "",
	getBgAnsi: () => "",
	getColorMode: () => "truecolor",
	getThinkingBorderColor: () => (text: string) => text,
	getBashModeBorderColor: () => (text: string) => text,
	colors: {},
	appearance: "dark",
} as unknown as Theme;

function sessionState(session: AgentSession): SessionState {
	const model = session.model;
	return {
		cwd: session.sessionManager.getCwd(),
		model: model ? { provider: model.provider, id: model.id, name: model.name } : undefined,
		thinkingLevel: session.thinkingLevel,
		isStreaming: session.isStreaming,
		sessionId: session.sessionId,
		sessionFile: session.sessionFile,
		messageCount: session.messages.length,
	};
}

async function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			promise,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
