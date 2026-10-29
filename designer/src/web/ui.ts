import { randomUUID } from "node:crypto";
import type { UiMethod, UiResponse } from "../../shared/protocol.js";
import type { UiPort } from "../runtime.js";

export interface UiBridge extends UiPort {
	/** Route an incoming `ui_response` to its pending request. */
	handleResponse(id: string, response: UiResponse): void;
}

export type UiSend = (id: string, method: UiMethod, payload: Record<string, unknown>) => void;

/**
 * L3 implementation of `UiPort`: dialogs travel as `ui_request` /
 * `ui_response` frames.
 *
 * Every dialog resolves with its fallback on abort / timeout / teardown; a
 * rejected promise would freeze the extension that is awaiting it.
 */
export function createUiBridge(send: UiSend): UiBridge {
	const pending = new Map<string, (response: UiResponse | undefined) => void>();

	return {
		request(method, payload, options) {
			if (options?.signal?.aborted) return Promise.resolve(undefined);

			const id = randomUUID();
			return new Promise<UiResponse | undefined>((resolve) => {
				let timer: ReturnType<typeof setTimeout> | undefined;

				const finish = (response: UiResponse | undefined): void => {
					if (timer !== undefined) clearTimeout(timer);
					options?.signal?.removeEventListener("abort", onAbort);
					pending.delete(id);
					resolve(response);
				};

				const onAbort = (): void => {
					finish(undefined);
				};

				options?.signal?.addEventListener("abort", onAbort, { once: true });
				if (options?.timeout) timer = setTimeout(() => finish(undefined), options.timeout);

				pending.set(id, finish);
				send(id, method, payload);
			});
		},

		notify: (message, level) => send(randomUUID(), "notify", { message, notifyType: level ?? "info" }),
		setStatus: (key, text) => send(randomUUID(), "setStatus", { key, text: text ?? null }),
		setTitle: (title) => send(randomUUID(), "setTitle", { title }),
		setEditorText: (text) => send(randomUUID(), "set_editor_text", { text }),

		closeAll(): void {
			for (const finish of [...pending.values()]) finish(undefined);
			pending.clear();
		},

		handleResponse(id, response): void {
			pending.get(id)?.(response);
		},
	};
}
