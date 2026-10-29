// test-acceptance.ts —— 首期验收链路自测（无需浏览器）
//
// 覆盖：
//   1. WS 连接 + pi 会话就绪（Bun 运行时）
//   2. Add To Context 报文（chips → 素材列表前缀）+ Agent 用 edit 工具改文件
//   3. 预览 bundle 重建后包含新内容（沙盒运行时）
//   4. 交付运行时 HTML 可访问（esm-x 页面）
//
// 前置：designer 后端已在 PI_WEB_PORT 上运行（PI_WEB_ROOT=.test-root）。
// 脚本会自建 workspace/page fixture，可重复运行。
// 用法：bun test-acceptance.ts
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.PI_WEB_PORT ?? 5602);
const ORIGIN = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}/ws?workspace=demo&clientId=acceptance-test`;
const WS_NAME = "demo";
const ROOT = path.resolve(import.meta.dir, ".test-root");
const WORKSPACE = path.join(ROOT, WS_NAME);
const COMPONENTS = path.join(WORKSPACE, "Components");
const HEADER = path.join(COMPONENTS, "Header.jsx");
const APP = path.join(WORKSPACE, "App.jsx");
const OLD = "Hello Before";
const EXPECTED = "Acceptance OK";

function log(step: string, ok: boolean, extra = ""): void {
	console.log(`${ok ? "✅" : "❌"} ${step}${extra ? ` — ${extra}` : ""}`);
	if (!ok) process.exitCode = 1;
}

async function postJson(url: string, body: unknown): Promise<Response> {
	return fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

// --- 0. fixture：workspace / page / 素材（幂等重置） ---
await postJson(`${ORIGIN}/api/workspaces`, { name: WS_NAME });
await postJson(`${ORIGIN}/api/pages`, { workspace: WS_NAME, page: "index" });

fs.mkdirSync(COMPONENTS, { recursive: true });
fs.writeFileSync(
	HEADER,
	`export default function Header() {\n  const title = "${OLD}";\n  return (\n    <header data-fileName="Components/Header.jsx" className="site-header">\n      <h1 className="site-title">{title}</h1>\n    </header>\n  );\n}\n`,
);
fs.writeFileSync(
	APP,
	`import Header from "./Components/Header.jsx";\n\nexport default function App() {\n  return (\n    <div data-fileName="App.jsx" className="app-root">\n      <Header />\n    </div>\n  );\n}\n`,
);
log("0. fixture 就绪（素材含旧内容）", fs.readFileSync(HEADER, "utf8").includes(OLD));

// --- 1. WS 连接 + ready ---
type Frame = { type: string; [key: string]: unknown };
const ws = new WebSocket(WS_URL);

const ready = await new Promise<boolean>((resolve) => {
	const timer = setTimeout(() => resolve(false), 60_000);
	ws.addEventListener("message", (message) => {
		const frame = JSON.parse(String(message.data)) as Frame;
		if (frame.type === "ready") {
			clearTimeout(timer);
			resolve(true);
		}
		if (frame.type === "error") {
			console.error("ws error:", frame);
			clearTimeout(timer);
			resolve(false);
		}
	});
	ws.addEventListener("error", () => {
		clearTimeout(timer);
		resolve(false);
	});
});
log("1. WS 握手 + pi 会话 ready", ready);
if (!ready) process.exit(1);

// --- 2. Add To Context 报文 → Agent 修改素材 ---
// 与前端 store.promptWithContext 生成的文本完全一致
const promptText = `请处理以下素材：\n- @Components/Header.jsx\n\n把 Header.jsx 里的字符串 "${OLD}" 改成 "${EXPECTED}"，不要做其他修改。`;
ws.send(JSON.stringify({ type: "prompt", text: promptText }));

const settled = await new Promise<boolean>((resolve) => {
	const timer = setTimeout(() => resolve(false), 240_000);
	ws.addEventListener("message", (message) => {
		const frame = JSON.parse(String(message.data)) as Frame;
		if (frame.type === "event") {
			const event = frame.event as Frame;
			if (event.type === "tool_execution_start") {
				console.log(`   · 工具: ${String(event.toolName)}`);
			}
			if (event.type === "agent_settled") {
				clearTimeout(timer);
				resolve(true);
			}
		}
	});
});
log("2. Agent 完成一轮（agent_settled）", settled);

const after = fs.readFileSync(HEADER, "utf8");
log("3. 素材文件已被 Agent 修改", after.includes(EXPECTED), after.includes(EXPECTED) ? "" : after);

// --- 3. 预览 bundle 重建（沙盒运行时） ---
const previewResponse = await fetch(`${ORIGIN}/preview/${WS_NAME}/index?t=${Date.now()}`, { cache: "no-store" });
const bundle = await previewResponse.text();
log("4. 预览 bundle HTTP 200", previewResponse.ok, `status=${previewResponse.status}`);
log("5. bundle 含 createRoot 挂载代码", bundle.includes("createRoot"));
log("6. bundle 含 Agent 写入的新内容", bundle.includes(EXPECTED));

// --- 4. 交付运行时页面（esm-x） ---
const deliverable = await fetch(`${ORIGIN}/w/${WS_NAME}/index.html`);
const html = await deliverable.text();
log("7. 交付物 HTML 可访问", deliverable.ok);
log("8. 交付物 HTML 走 esm-x 内联入口", html.includes('type="esm-x"') && html.includes("./index.mount.jsx"));

// --- 5. vendor 依赖可服务 ---
const vendor = await fetch(`${ORIGIN}/w/${WS_NAME}/vendor/esm-x.js`);
log("9. vendor/esm-x.js 可服务", vendor.ok && vendor.headers.get("content-type")?.includes("javascript") === true);

ws.close();
console.log(process.exitCode ? "\n验收失败" : "\n验收通过");
