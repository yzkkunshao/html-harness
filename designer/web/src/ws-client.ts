import type { ClientMessage, ServerMessage } from "@shared/protocol";

type WsHandlers = {
	onMessage: (message: ServerMessage) => void;
	onClose?: () => void;
};

/**
 * One socket, one workspace, no reconnect.
 *
 * There is no session to restore, so an automatic reconnect would silently
 * start a new session and drop the history the user is looking at. Reopening a
 * workspace is an explicit user action instead.
 */
export class WsClient {
	private readonly socket: WebSocket;
	private heartbeat?: number;

	constructor(workspace: string, clientId: string, handlers: WsHandlers) {
		const protocol = location.protocol === "https:" ? "wss" : "ws";
		const query = new URLSearchParams({ workspace, clientId });
		this.socket = new WebSocket(`${protocol}://${location.host}/ws?${query.toString()}`);

		this.socket.addEventListener("open", () => this.startHeartbeat());

		this.socket.addEventListener("message", (event) => {
			let message: ServerMessage;
			try {
				message = JSON.parse(String(event.data)) as ServerMessage;
			} catch {
				return;
			}
			handlers.onMessage(message);
		});

		this.socket.addEventListener("close", () => {
			this.stopHeartbeat();
			handlers.onClose?.();
		});

		this.socket.addEventListener("error", () => {
			this.socket.close();
		});
	}

	send(message: ClientMessage): void {
		if (this.socket.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify(message));
	}

	close(): void {
		this.stopHeartbeat();
		this.socket.close();
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeat = window.setInterval(() => this.send({ type: "ping" }), 25_000);
	}

	private stopHeartbeat(): void {
		if (this.heartbeat !== undefined) {
			window.clearInterval(this.heartbeat);
			this.heartbeat = undefined;
		}
	}
}
