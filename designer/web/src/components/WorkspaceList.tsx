import { useEffect, useState } from "react";
import type { WorkspaceEntry } from "@shared/protocol";
import { store, type Snapshot } from "../store";

/**
 * The only way in: list the root's workspaces, create one, or switch to one.
 *
 * Switching always ends the current session, so it goes through an explicit
 * confirmation. Cancelling changes nothing: the old connection and runtime
 * stay exactly as they were.
 */
export function WorkspaceList({ snapshot, onClose }: { snapshot: Snapshot; onClose?: () => void }) {
	const [confirming, setConfirming] = useState<WorkspaceEntry>();
	const [name, setName] = useState("");
	const [error, setError] = useState<string>();
	const [busy, setBusy] = useState(false);

	const hasSession = snapshot.state !== undefined;

	useEffect(() => {
		void store.refreshWorkspaces();
	}, []);

	function choose(entry: WorkspaceEntry): void {
		if (snapshot.switching) return;
		if (hasSession) {
			setConfirming(entry);
			return;
		}
		store.openWorkspace(entry.name);
	}

	async function create(): Promise<void> {
		const value = name.trim();
		if (!value || busy) return;

		setBusy(true);
		setError(undefined);
		try {
			const entry = await store.createWorkspace(value);
			setName("");
			if (hasSession) setConfirming(entry);
			else store.openWorkspace(entry.name);
		} catch (createError) {
			setError(errorMessage(createError));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="workspace-panel">
			<header className="workspace-head">
				<div>
					<h1 className="workspace-title">Workspaces</h1>
					<p className="workspace-sub" title={snapshot.root}>
						{snapshot.root ? `root: ${snapshot.root}` : "loading root…"}
					</p>
				</div>
				{onClose && (
					<button type="button" className="button button-ghost button-small" onClick={onClose}>
						Close
					</button>
				)}
			</header>

			{snapshot.workspacesError && <div className="workspace-error">{snapshot.workspacesError}</div>}
			{error && <div className="workspace-error">{error}</div>}
			{snapshot.lastError && <div className="workspace-error">{snapshot.lastError}</div>}
			{snapshot.switching && <div className="workspace-status">Opening workspace…</div>}

			<ul className="workspace-list">
				{snapshot.workspaces.map((entry) => (
					<li key={entry.name}>
						<button
							type="button"
							className={`workspace-entry${entry.name === snapshot.workspace ? " workspace-entry-active" : ""}`}
							onClick={() => choose(entry)}
							disabled={snapshot.switching}
							title={entry.path}
						>
							<span className="workspace-entry-name">{entry.name}</span>
							<span className="workspace-entry-path">{entry.path}</span>
						</button>
					</li>
				))}
				{snapshot.workspaces.length === 0 && (
					<li className="workspace-empty">No workspaces yet. Create one below.</li>
				)}
			</ul>

			<form
				className="workspace-form"
				onSubmit={(event) => {
					event.preventDefault();
					void create();
				}}
			>
				<input
					className="text-input"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="new workspace name"
					disabled={busy}
				/>
				<button type="submit" className="button" disabled={busy || name.trim().length === 0}>
					Create
				</button>
			</form>

			{confirming && (
				<div className="workspace-confirm">
					<p className="modal-message">
						Switch to <strong>{confirming.name}</strong>? The current session ends and its history is not kept.
					</p>
					<div className="modal-actions">
						<button
							type="button"
							className="button"
							onClick={() => {
								const entry = confirming;
								setConfirming(undefined);
								store.openWorkspace(entry.name);
							}}
						>
							Switch
						</button>
						<button type="button" className="button button-ghost" onClick={() => setConfirming(undefined)}>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
