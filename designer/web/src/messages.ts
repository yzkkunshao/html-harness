import type { AgentMessage } from "@shared/protocol";

export function messageText(message: AgentMessage): string {
	if (!("content" in message)) return "";
	const content: unknown = message.content;

	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	const parts: string[] = [];
	for (const part of content) {
		if (!isRecord(part)) continue;
		if (part.type === "text" && typeof part.text === "string") parts.push(part.text);
		else if (part.type === "thinking" && typeof part.thinking === "string") parts.push(part.thinking);
		else if (part.type === "image") parts.push("[image]");
	}
	return parts.join("");
}

export function messageRole(message: AgentMessage): string {
	return isRecord(message) && typeof message.role === "string" ? message.role : "unknown";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function pretty(value: unknown, max = 4000): string {
	let text: string;
	if (typeof value === "string") text = value;
	else {
		try {
			text = JSON.stringify(value, null, 2);
		} catch {
			text = String(value);
		}
	}
	return text.length > max ? `${text.slice(0, max)}\n…` : text;
}
