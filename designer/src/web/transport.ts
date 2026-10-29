import type { ServerWebSocket } from "bun";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ClientMessage, Diagnostic, ErrorCode, ServerMessage } from "../../shared/protocol.js";
import type { WorkspaceRuntime } from "../runtime.js";
import { toWireEvent } from "./events.js";
import { createUiBridge, type UiBridge } from "./ui.js";

/**
 * L3: everything that belongs to exactly one WebSocket (Bun 原生实现).
 *
 * It owns the framing (`seq`), the inbound command routing and the event
 * forwarding. It does not decide when a connection exists, and it does not
 * know how a runtime is built.
 */
export interface Transport {
	readonly ui: UiBridge;
	sendHello(workspace: string, cwd: string): void;
	sendReady(runtime: WorkspaceRuntime): void;
	sendDiagnostic(diagnostic: Diagnostic): void;
	sendError(code: ErrorCode, message: string): void;
	onEvent(event: AgentSessionEvent): void;
	/** Start accepting client commands. Before this, every command is rejected. */
	attach(runtime: WorkspaceRuntime): void;
	handleMessage(raw: string): Promise<void>;
	close(): Promise<void>;
}

const WS_OPEN = 1; // Bun ServerWebSocket readyState

export function createTransport(options: { ws: ServerWebSocket<unknown>; signal: AbortSignal }): Transport {
	const { ws, signal } = options;
	let seq = 0;
	let runtime: WorkspaceRuntime | undefined;

	const envelope = (): { v: 1; seq: number } => ({ v: 1, seq: ++seq });

	const send = (message: ServerMessage): void => {
		if (signal.aborted) return;
		if (ws.readyState !== WS_OPEN) return;
		try {
			ws.send(JSON.stringify(message));
		} catch {
			// The socket closed between the state check and send().
		}
	};

	const sendError = (code: ErrorCode, message: string): void => {
		send({ ...envelope(), type: "error", code, message });
	};

	const ui = createUiBridge((id, method, payload) => {
		send({ ...envelope(), type: "ui_request", id, method, payload });
	});

	async function handleMessage(raw: string): Promise<void> {
		let message: ClientMessage;
		try {
			message = JSON.parse(raw) as ClientMessage;
		} catch {
			sendError("BAD_REQUEST", "Invalid JSON");
			return;
		}

		if (message.type === "ping") {
			send({ ...envelope(), type: "pong" });
			return;
		}

		if (message.type === "ui_response") {
			ui.handleResponse(message.id, message.response);
			return;
		}

		const current = runtime;
		if (!current) {
			sendError("BAD_REQUEST", "Workspace is not ready yet");
			return;
		}

		switch (message.type) {
			case "prompt": {
				if (typeof message.text !== "string" || message.text.length === 0) {
					sendError("BAD_REQUEST", "Prompt text is required");
					return;
				}
				current.prompt(message.text, { images: message.images, behavior: message.behavior });
				return;
			}

			case "steer": {
				try {
					await current.steer(message.text);
				} catch (error) {
					sendError("BAD_REQUEST", errorMessage(error));
				}
				return;
			}

			case "follow_up": {
				try {
					await current.followUp(message.text);
				} catch (error) {
					sendError("BAD_REQUEST", errorMessage(error));
				}
				return;
			}

			case "abort": {
				await current.abort();
				return;
			}
		}
	}

	return {
		ui,

		sendHello(workspace, cwd): void {
			send({ ...envelope(), type: "hello", workspace, cwd });
		},

		sendReady(current): void {
			send({
				...envelope(),
				type: "ready",
				state: current.readState(),
				messages: current.readMessages(),
				sessionFile: current.readState().sessionFile,
			});
			for (const diagnostic of current.diagnostics) {
				send({ ...envelope(), type: "diagnostic", diagnostic });
			}
		},

		sendDiagnostic(diagnostic): void {
			send({ ...envelope(), type: "diagnostic", diagnostic });
		},

		sendError,

		onEvent(event): void {
			if (event.type === "queue_update") {
				send({
					...envelope(),
					type: "queue",
					steering: [...event.steering],
					followUp: [...event.followUp],
				});
				return;
			}

			const wire = toWireEvent(event);
			if (!wire) return;
			send({ ...envelope(), type: "event", event: wire });
		},

		attach(current): void {
			runtime = current;
		},

		handleMessage,

		async close(): Promise<void> {
			if (ws.readyState !== WS_OPEN) return;
			ws.close();
		},
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
