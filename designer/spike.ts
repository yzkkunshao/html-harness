// spike.ts —— M0 冒烟验证：Bun 下 createAgentSession + read/edit 工具链
// 通过标准：Agent 能读取 workspace 内文件并用 edit 工具修改成功
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { getAgentDir, ModelRuntime, ProjectTrustStore } from "@earendil-works/pi-coding-agent";

const WORKSPACE = path.join(import.meta.dir, ".spike-workspace");
const ENTRY = path.join(WORKSPACE, "Components", "Header.jsx");

// --- 准备最小 workspace ---
fs.rmSync(WORKSPACE, { recursive: true, force: true });
fs.mkdirSync(path.dirname(ENTRY), { recursive: true });
fs.writeFileSync(
	ENTRY,
	`export default function Header() {\n  const title = "Spike Before";\n  return <h1 className="app-header">{title}</h1>;\n}\n`,
);

// --- 进程级服务（同 skeleton L0/L1 的最小子集） ---
const agentDir = getAgentDir();
const modelRuntime = await ModelRuntime.create({
	authPath: path.join(agentDir, "auth.json"),
	modelsPath: path.join(agentDir, "models.json"),
});
const trustStore = new ProjectTrustStore(agentDir);

// 动态 import pi 的会话创建（验证 Bun 能加载整包）
const pi = await import(pathToFileURL(
	path.join(import.meta.dir, "node_modules/@earendil-works/pi-coding-agent/dist/index.js"),
).href);

const { SettingsManager, DefaultResourceLoader, hasTrustRequiringProjectResources, createAgentSession, SessionManager } = pi;

const projectTrusted = !hasTrustRequiringProjectResources(WORKSPACE) || trustStore.get(WORKSPACE) === true;
const settingsManager = SettingsManager.create(WORKSPACE, agentDir, { projectTrusted });
const resourceLoader = new DefaultResourceLoader({ cwd: WORKSPACE, agentDir, settingsManager });
await resourceLoader.reload();
await modelRuntime.refresh({ allowNetwork: false });

const models = modelRuntime.getAllModels();
console.log(`[spike] 模型目录: ${models.map((m: any) => `${m.provider}/${m.id}`).join(", ") || "(无)"}`);

const { session, modelFallbackMessage } = await createAgentSession({
	cwd: WORKSPACE,
	agentDir,
	modelRuntime,
	settingsManager,
	resourceLoader,
	sessionManager: SessionManager.create(WORKSPACE),
	sessionStartEvent: { type: "session_start", reason: "startup" },
});
if (modelFallbackMessage) console.log(`[spike] model fallback: ${modelFallbackMessage}`);
console.log(`[spike] session 创建成功, model = ${session.model?.id ?? "(未设置)"}`);

if (!session.model) {
	console.error("[spike] 失败：无可用模型（检查 auth.json / models.json）");
	process.exit(1);
}

// --- 事件监听（只关心工具执行） ---
const seenTools: string[] = [];
session.subscribe((event: any) => {
	if (event.type === "tool_execution_start") {
		seenTools.push(event.args?.toolName ?? event.toolName ?? "?");
		console.log(`[spike] 工具开始: ${event.args?.toolName ?? event.toolName}`);
	}
	if (event.type === "message_update" && event.delta) return; // 流式 delta 太吵，忽略
});

// --- 绑定扩展（rpc 模式最小 stub，同 skeleton toBindings 的裁剪版） ---
await session.bindExtensions({
	uiContext: {
		notify: () => {},
		setStatus: () => {},
		setTitle: () => {},
	} as any,
	mode: "rpc",
	abortHandler: () => {},
	shutdownHandler: () => {},
	onError: (e: any) => console.error(`[spike] 扩展错误: ${e.error}`),
	commandContextActions: {
		waitForIdle: () => session.waitForIdle(),
		newSession: async () => ({ cancelled: true }),
		fork: async () => ({ cancelled: true }),
		switchSession: async () => ({ cancelled: true }),
		navigateTree: async () => ({ cancelled: true }),
		reload: async () => {},
	},
});

// --- 发 prompt：让 Agent 修改 title 字段（验证 read + edit 全链路） ---
console.log("[spike] 发送 prompt ...");
await session.prompt(
	`请读取 ${path.relative(WORKSPACE, ENTRY).replaceAll("\\\\", "/")} 的内容，把其中的字符串 "Spike Before" 改成 "Spike OK"，不要做任何其他修改。`,
	{ source: "rpc" },
);
await session.waitForIdle();

// --- 校验 ---
const after = fs.readFileSync(ENTRY, "utf8");
const ok = after.includes("Spike OK");
console.log(`[spike] 用到的工具: ${seenTools.join(", ") || "(无)"}`);
console.log(`[spike] 文件内容已变更: ${ok ? "✅ 是" : "❌ 否"}`);
console.log("---- 修改后文件 ----");
console.log(after);

session.dispose();
process.exit(ok ? 0 : 1);
