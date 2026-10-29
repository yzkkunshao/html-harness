import type { Diagnostic } from "@shared/protocol";

export function DiagnosticsBar({ diagnostics }: { diagnostics: Diagnostic[] }) {
	const recent = diagnostics.slice(-3);
	if (recent.length === 0) return null;

	return (
		<div className="diagnostics">
			{recent.map((diagnostic, index) => (
				<div className={`diagnostic diagnostic-${diagnostic.type}`} key={`${index}-${diagnostic.message}`}>
					<span className="diagnostic-type">{diagnostic.type}</span>
					<span className="diagnostic-message">{diagnostic.message}</span>
				</div>
			))}
			{recent.length < diagnostics.length && (
				<div className="diagnostic diagnostic-more">… {diagnostics.length - recent.length} older diagnostic(s)</div>
			)}
		</div>
	);
}
