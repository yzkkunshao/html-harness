import { resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface AppConfig {
	port: number;
	/** Raw `PI_WEB_ROOT`. Resolved into a realpath by `resolveWorkspaceRoot()`. */
	root: string;
	agentDir: string;
	webDist: string;
}

export function loadConfig(): AppConfig {
	return {
		port: Number(process.env.PI_WEB_PORT ?? 5602),
		root: resolve(process.env.PI_WEB_ROOT ?? process.cwd()),
		agentDir: resolve(process.env.PI_AGENT_DIR ?? getAgentDir()),
		webDist: resolve(process.cwd(), "web-dist"),
	};
}
