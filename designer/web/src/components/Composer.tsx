import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { store, type Snapshot } from "../store";

/**
 * 对话输入框（右侧栏）。
 *
 * Add To Context 的 chips 显示在输入框上方，可逐个移除；发送时 chips 拼成
 * 素材列表注入提示词前缀（见 store.promptWithContext）。
 */
export function Composer({ snapshot }: { snapshot: Snapshot }) {
	const [text, setText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const injectionNonce = snapshot.editorText.nonce;

	useEffect(() => {
		if (injectionNonce === 0) return;
		setText(snapshot.editorText.text);
		textareaRef.current?.focus();
	}, [injectionNonce, snapshot.editorText.text]);

	const disabled = snapshot.connection !== "open" || snapshot.switching;
	const streaming = snapshot.state?.isStreaming === true;
	const canSend = text.trim().length > 0 || snapshot.chips.length > 0;

	function submit(behavior?: "steer" | "followUp"): void {
		if (!canSend || disabled) return;
		store.promptWithContext(text, behavior);
		setText("");
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.nativeEvent.isComposing) return;
		if (event.key === "Escape") {
			event.preventDefault();
			store.abort();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit(event.altKey ? "followUp" : undefined);
		}
	}

	return (
		<footer className="composer">
			{snapshot.chips.length > 0 && (
				<div className="chips" aria-label="已注入的上下文素材">
					{snapshot.chips.map((chip) => (
						<span className="chip" key={chip} title={chip}>
							<span className="chip-at">@</span>
							<span className="chip-path">{chip}</span>
							<button
								type="button"
								className="chip-remove"
								aria-label={`移除 ${chip}`}
								onClick={() => store.removeChip(chip)}
							>
								✕
							</button>
						</span>
					))}
				</div>
			)}

			<textarea
				ref={textareaRef}
				className="composer-input"
				value={text}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={
					disabled
						? "Waiting for a session…"
						: snapshot.chips.length > 0
							? "描述要怎么改（可留空，直接让 Agent 处理素材）…"
							: "Message pi…  Enter send · Alt+Enter follow-up · Esc stop"
				}
				rows={4}
				disabled={disabled}
			/>
			<div className="composer-actions">
				<span className="composer-hint">
					{streaming ? "streaming — Enter steers, Alt+Enter queues a follow-up" : "Enter sends"}
				</span>
				{streaming && (
					<button type="button" className="button button-danger" onClick={() => store.abort()}>
						Stop
					</button>
				)}
				<button type="button" className="button" onClick={() => submit()} disabled={disabled || !canSend}>
					Send
				</button>
				<button
					type="button"
					className="button button-ghost"
					onClick={() => submit("followUp")}
					disabled={disabled || !canSend}
					title="Queue after the current run"
				>
					Follow up
				</button>
			</div>
		</footer>
	);
}
