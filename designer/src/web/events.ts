import type { AgentSessionEvent, JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";

type WireEvent = JsonAgentSessionEvent;

/**
 * Convert an AgentSessionEvent to the wire shape.
 *
 * - `message_update` loses its cumulative `partial` snapshot (the browser has
 *   `message_start` + deltas; re-sending the whole message per token is waste).
 * - `tool_execution_update` is dropped entirely.
 * - Events the UI does not consume are dropped.
 */
export function toWireEvent(event: AgentSessionEvent): WireEvent | null {
	switch (event.type) {
		case "message_update": {
			if (event.message.role !== "assistant") return null;
			return {
				type: "message_update",
				usage: event.message.usage,
				assistantMessageEvent: stripAssistantEvent(event.assistantMessageEvent),
			} as unknown as WireEvent;
		}
		case "message_start":
		case "message_end":
		case "tool_execution_start":
		case "tool_execution_end":
		case "agent_start":
		case "agent_end":
		case "agent_settled":
		case "compaction_start":
		case "compaction_end":
		case "auto_retry_start":
		case "auto_retry_end":
			return event as WireEvent;
		default:
			// queue_update is sent as its own ServerMessage; the rest is not MVP.
			return null;
	}
}

function stripAssistantEvent(event: unknown): unknown {
	if (!isRecord(event)) return event;

	if (event.type === "toolcall_start") {
		const partial = event.partial;
		const contentIndex = typeof event.contentIndex === "number" ? event.contentIndex : -1;
		const content = isRecord(partial) && Array.isArray(partial.content) ? partial.content : [];
		const toolCall = content[contentIndex];
		if (isRecord(toolCall) && toolCall.type === "toolCall" && typeof toolCall.id === "string" && typeof toolCall.name === "string") {
			const { partial: _partial, ...rest } = event;
			return { ...rest, id: toolCall.id, toolName: toolCall.name };
		}
	}

	if ("partial" in event) {
		const { partial: _partial, ...rest } = event;
		return rest;
	}

	return event;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
