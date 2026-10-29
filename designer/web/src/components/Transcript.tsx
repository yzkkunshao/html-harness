import { useEffect, useRef } from "react";
import { isRecord, messageRole, messageText, pretty } from "../messages";
import type { Snapshot } from "../store";

export function Transcript({ snapshot }: { snapshot: Snapshot }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const stickToBottom = useRef(true);

	const lastMessageIndex = snapshot.messages.length - 1;

	useEffect(() => {
		const element = scrollRef.current;
		if (!element || !stickToBottom.current) return;
		element.scrollTop = element.scrollHeight;
	}, [snapshot.messages.length, snapshot.streamingText, snapshot.tools.length]);

	function onScroll(): void {
		const element = scrollRef.current;
		if (!element) return;
		stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
	}

	return (
		<div className="transcript" ref={scrollRef} onScroll={onScroll}>
			{snapshot.messages.length === 0 && !snapshot.streamingText && (
				<div className="empty">
					<p className="empty-title">页面设计器</p>
					<p>在左侧打开预览，开启「组件选中」后单击任意组件并 Add To Context，再描述要改什么。</p>
				</div>
			)}

			{snapshot.messages.map((message, index) => {
				const role = messageRole(message);
				if (role !== "user" && role !== "assistant") return null;

				const streaming = role === "assistant" && index === lastMessageIndex && snapshot.state?.isStreaming;
				const text = streaming ? snapshot.streamingText : messageText(message);
				const thinking = streaming ? snapshot.thinkingText : "";

				return (
					<article className={`bubble bubble-${role}`} key={`${role}-${index}`}>
						<div className="bubble-role">{role}</div>
						{thinking && (
							<details className="thinking" open>
								<summary>thinking</summary>
								<pre>{thinking}</pre>
							</details>
						)}
						{text && <div className="bubble-text">{text}</div>}
						{!text && !thinking && streaming && <div className="bubble-text streaming">…</div>}
					</article>
				);
			})}

			{snapshot.tools.length > 0 && (
				<section className="tools">
					{snapshot.tools.map((tool) => (
						<ToolCard key={tool.toolCallId} tool={tool} />
					))}
				</section>
			)}
		</div>
	);
}

function ToolCard({ tool }: { tool: Snapshot["tools"][number] }) {
	const args = isRecord(tool.args) ? tool.args : undefined;
	const label =
		(typeof args?.path === "string" && args.path) ||
		(typeof args?.command === "string" && args.command) ||
		(typeof args?.pattern === "string" && args.pattern) ||
		"";

	return (
		<details className={`tool tool-${tool.status}`}>
			<summary>
				<span className="tool-name">{tool.toolName}</span>
				<span className="tool-status">{tool.status}</span>
				{label && <span className="tool-label">{label}</span>}
			</summary>
			<div className="tool-body">
				<div className="tool-section-title">args</div>
				<pre>{pretty(tool.args)}</pre>
				{tool.result !== undefined && (
					<>
						<div className="tool-section-title">result</div>
						<pre>{pretty(tool.result)}</pre>
					</>
				)}
			</div>
		</details>
	);
}
