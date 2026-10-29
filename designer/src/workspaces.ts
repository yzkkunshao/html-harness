import { mkdir, readdir, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ErrorCode, WorkspaceEntry } from "../shared/protocol.js";

/**
 * Thrown by every workspace operation. `status` is the HTTP equivalent, so the
 * server can answer `POST /api/workspaces` and the WS handshake with the same
 * number.
 */
export class WorkspaceError extends Error {
	readonly code: ErrorCode;
	readonly status: number;

	constructor(code: ErrorCode, status: number, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

const PATH_SEPARATORS = /[\\/]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * A workspace name is a single path segment: no separators, no leading dot, no
 * `.`/`..`, no control characters, no surrounding whitespace.
 */
export function parseWorkspaceName(raw: unknown): string {
	if (typeof raw !== "string") {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, "Workspace name must be a string");
	}
	if (raw.length === 0) {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, "Workspace name must not be empty");
	}
	if (raw !== raw.trim()) {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, `Workspace name has surrounding whitespace: ${JSON.stringify(raw)}`);
	}
	if (raw === "." || raw === ".." || raw.startsWith(".")) {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, `Workspace name must not start with ".": ${raw}`);
	}
	if (PATH_SEPARATORS.test(raw)) {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, `Workspace name must be a single path segment: ${raw}`);
	}
	if (CONTROL_CHARS.test(raw)) {
		throw new WorkspaceError("BAD_WORKSPACE_NAME", 400, "Workspace name must not contain control characters");
	}
	return raw;
}

/** Resolve `PI_WEB_ROOT` into a realpath, creating it when missing. */
export async function resolveWorkspaceRoot(raw: string): Promise<string> {
	const absolute = resolve(raw);
	try {
		await mkdir(absolute, { recursive: true });
	} catch (error) {
		throw new Error(`Cannot create PI_WEB_ROOT ${absolute}: ${errorMessage(error)}`);
	}

	const real = await realpathSafe(absolute);
	if (!real) throw new Error(`PI_WEB_ROOT is not a directory: ${absolute}`);
	return real;
}

/** First-level directories of `root`. Hidden entries, files and escaping links are skipped. */
export async function listWorkspaces(root: string): Promise<WorkspaceEntry[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const workspaces: WorkspaceEntry[] = [];

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

		const real = await realpathSafe(join(root, entry.name));
		if (!real) continue;

		const info = await stat(real).catch(() => undefined);
		if (!info?.isDirectory()) continue;
		if (dirname(real) !== root) continue;

		workspaces.push({ name: entry.name, path: real });
	}

	workspaces.sort((a, b) => a.name.localeCompare(b.name));
	return workspaces;
}

/** Create one empty directory directly under `root`. */
export async function createWorkspace(root: string, rawName: unknown): Promise<WorkspaceEntry> {
	const name = parseWorkspaceName(rawName);
	const target = join(root, name);

	const existing = await stat(target).catch(() => undefined);
	if (existing) {
		throw new WorkspaceError("WORKSPACE_EXISTS", 409, `Workspace already exists: ${name}`);
	}

	try {
		await mkdir(target);
	} catch (error) {
		if (isErrno(error, "EEXIST")) {
			throw new WorkspaceError("WORKSPACE_EXISTS", 409, `Workspace already exists: ${name}`);
		}
		throw new WorkspaceError("INTERNAL", 500, `Cannot create workspace ${name}: ${errorMessage(error)}`);
	}

	const real = await realpathSafe(target);
	if (!real) throw new WorkspaceError("INTERNAL", 500, `Workspace disappeared after creation: ${name}`);
	return { name, path: real };
}

/**
 * Validate `name` and return the workspace's realpath. The parent-directory
 * equality check keeps every workspace inside `root`.
 */
export async function resolveWorkspace(root: string, rawName: unknown): Promise<WorkspaceEntry> {
	const name = parseWorkspaceName(rawName);
	const real = await realpathSafe(join(root, name));
	if (!real) throw new WorkspaceError("WORKSPACE_NOT_FOUND", 404, `Workspace not found: ${name}`);

	const info = await stat(real).catch(() => undefined);
	if (!info?.isDirectory()) throw new WorkspaceError("WORKSPACE_NOT_FOUND", 404, `Not a directory: ${name}`);
	if (dirname(real) !== root) {
		throw new WorkspaceError("FORBIDDEN_PATH", 403, `Workspace escapes PI_WEB_ROOT: ${name}`);
	}

	return { name, path: real };
}

async function realpathSafe(path: string): Promise<string | undefined> {
	try {
		return await realpath(path);
	} catch {
		return undefined;
	}
}

function isErrno(error: unknown, code: string): boolean {
	return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
