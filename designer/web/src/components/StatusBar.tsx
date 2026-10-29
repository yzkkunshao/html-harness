import type { Snapshot } from "../store";

export function StatusBar({ snapshot }: { snapshot: Snapshot }) {
	const state = snapshot.state;
	const model = state?.model ? `${state.model.provider}/${state.model.id}` : "no model";
	const statuses = Object.entries(snapshot.statuses);

	return (
		<div className="statusbar">
			<span className={`dot dot-${snapshot.connection}`} title={snapshot.connection} />
			<span className="status-item" title="active model">
				{model}
			</span>
			<span className="status-item" title="thinking level">
				thinking: {state?.thinkingLevel ?? "off"}
			</span>
			{state?.isStreaming && <span className="status-item status-busy">streaming</span>}
			{snapshot.queue.steering.length > 0 && (
				<span className="status-item status-queue" title="steering queue">
					steer {snapshot.queue.steering.length}
				</span>
			)}
			{snapshot.queue.followUp.length > 0 && (
				<span className="status-item status-queue" title="follow-up queue">
					follow-up {snapshot.queue.followUp.length}
				</span>
			)}
			{statuses.map(([key, text]) => (
				<span className="status-item status-extension" key={key} title={key}>
					{text}
				</span>
			))}
			<span className="status-item status-workspace" title={snapshot.cwd}>
				{snapshot.workspace ?? "no workspace"}
			</span>
		</div>
	);
}
