import { useState } from "react";
import type { UiRequest } from "../store";
import { store } from "../store";

export function ExtensionDialog({ requests }: { requests: UiRequest[] }) {
	const request = requests[0];
	if (!request) return null;
	return <Dialog key={request.id} request={request} />;
}

function Dialog({ request }: { request: UiRequest }) {
	const title = String(request.payload.title ?? "Extension");
	const payload = request.payload;

	function respond(value?: string): void {
		if (value === undefined) store.respondUi(request.id, { cancelled: true });
		else store.respondUi(request.id, { value });
	}

	function confirm(confirmed: boolean): void {
		store.respondUi(request.id, { confirmed });
	}

	return (
		<div className="modal-backdrop">
			<div className="modal" role="dialog" aria-modal="true">
				<div className="modal-head">
					<span>{title}</span>
					<button type="button" className="button button-ghost button-small" onClick={() => respond()}>
						✕
					</button>
				</div>

				{request.method === "confirm" && <ConfirmBody message={String(payload.message ?? "")} onConfirm={confirm} />}
				{request.method === "select" && <SelectBody options={payload.options} onSelect={respond} />}
				{request.method === "input" && <InputBody placeholder={String(payload.placeholder ?? "")} onSubmit={respond} />}
				{request.method === "editor" && <EditorBody prefill={String(payload.prefill ?? "")} onSubmit={respond} />}

				<div className="modal-foot">
					<button type="button" className="button button-ghost" onClick={() => respond()}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

function ConfirmBody({ message, onConfirm }: { message: string; onConfirm: (confirmed: boolean) => void }) {
	return (
		<>
			<p className="modal-message">{message}</p>
			<div className="modal-actions">
				<button type="button" className="button" onClick={() => onConfirm(true)}>
					Confirm
				</button>
				<button type="button" className="button button-ghost" onClick={() => onConfirm(false)}>
					Deny
				</button>
			</div>
		</>
	);
}

function SelectBody({ options, onSelect }: { options: unknown; onSelect: (value: string) => void }) {
	const list = Array.isArray(options) ? options.map(String) : [];
	return (
		<div className="modal-options">
			{list.map((option) => (
				<button type="button" key={option} className="modal-option" onClick={() => onSelect(option)}>
					{option}
				</button>
			))}
			{list.length === 0 && <p className="modal-message">No options.</p>}
		</div>
	);
}

function InputBody({ placeholder, onSubmit }: { placeholder: string; onSubmit: (value: string) => void }) {
	const [value, setValue] = useState("");
	return (
		<form
			className="modal-form"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(value);
			}}
		>
			<input autoFocus className="text-input" value={value} placeholder={placeholder} onChange={(event) => setValue(event.target.value)} />
			<button type="submit" className="button">
				Submit
			</button>
		</form>
	);
}

function EditorBody({ prefill, onSubmit }: { prefill: string; onSubmit: (value: string) => void }) {
	const [value, setValue] = useState(prefill);
	return (
		<form
			className="modal-form modal-form-column"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(value);
			}}
		>
			<textarea autoFocus className="composer-input" rows={8} value={value} onChange={(event) => setValue(event.target.value)} />
			<button type="submit" className="button">
				Submit
			</button>
		</form>
	);
}
