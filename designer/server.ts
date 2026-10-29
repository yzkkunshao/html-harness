// server.ts —— 设计器后端入口（Bun 单进程：pi 会话 + 预览打包 + 静态服务）
// 用法：bun server.ts
import { join } from "node:path";
import { ModelRuntime, ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./src/config.js";
import { resolveWorkspaceRoot } from "./src/workspaces.js";
import { createDesignerServer } from "./src/web/server.js";

async function main(): Promise<void> {
	const config = loadConfig();

	let root: string;
	try {
		root = await resolveWorkspaceRoot(config.root);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	const modelRuntime = await ModelRuntime.create({
		authPath: join(config.agentDir, "auth.json"),
		modelsPath: join(config.agentDir, "models.json"),
	});
	const trustStore = new ProjectTrustStore(config.agentDir);

	const server = createDesignerServer({
		root,
		agentDir: config.agentDir,
		modelRuntime,
		trustStore,
		port: config.port,
		webDist: config.webDist,
	});

	console.log(`html-harness designer: http://localhost:${config.port}`);
	console.log(`root:     ${root}`);
	console.log(`agentDir: ${config.agentDir}`);

	let shuttingDown = false;
	const shutdown = (code: number): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		try {
			server.close();
		} catch (error) {
			console.error("shutdown failed", error);
		}
		process.exit(code);
	};

	process.on("SIGINT", () => shutdown(0));
	process.on("SIGTERM", () => shutdown(0));
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
