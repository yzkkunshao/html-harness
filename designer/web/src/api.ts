import type { FileTree, PageList, WorkspaceEntry, WorkspaceList } from "@shared/protocol";

export async function listWorkspaces(): Promise<WorkspaceList> {
	return parse<WorkspaceList>(await fetch("/api/workspaces"));
}

export async function createWorkspace(name: string): Promise<WorkspaceEntry> {
	return parse<WorkspaceEntry>(
		await fetch("/api/workspaces", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name }),
		}),
	);
}

export async function listPages(workspace: string): Promise<PageList> {
	return parse<PageList>(await fetch(`/api/pages?workspace=${encodeURIComponent(workspace)}`));
}

export async function createPage(workspace: string, page: string): Promise<{ page: string }> {
	return parse<{ page: string }>(
		await fetch("/api/pages", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ workspace, page }),
		}),
	);
}

export async function listFiles(workspace: string): Promise<FileTree> {
	return parse<FileTree>(await fetch(`/api/files?workspace=${encodeURIComponent(workspace)}`));
}

async function parse<T>(response: Response): Promise<T> {
	const body = (await response.json().catch(() => undefined)) as (T & { error?: string }) | undefined;
	if (!response.ok) throw new Error(body?.error ?? `Request failed: ${response.status}`);
	return body as T;
}
