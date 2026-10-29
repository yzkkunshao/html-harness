// test-ui.ts —— 真实浏览器验收（Chrome headless + CDP）
//
// 覆盖首期验收标准：选中组件 → Add To Context → chips 出现在对话输入区。
// 前置：designer 后端以生产模式运行（web-dist 已构建），workspace "demo" 含页面 index。
// 用法：bun test-ui.ts
import { spawn } from "node:child_process";
import fs from "node:fs";

const ORIGIN = `http://localhost:${process.env.PI_WEB_PORT ?? 5602}/`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PROFILE = `${import.meta.dir}/.chrome-profile`;
const CDP_PORT = 9333;

function log(step: string, ok: boolean, extra = ""): void {
	console.log(`${ok ? "✅" : "❌"} ${step}${extra ? ` — ${extra}` : ""}`);
	if (!ok) process.exitCode = 1;
}

fs.rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(
	CHROME,
	[
		"--headless=new",
		`--remote-debugging-port=${CDP_PORT}`,
		`--user-data-dir=${PROFILE}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-gpu",
		"--window-size=1600,1000",
		"about:blank",
	],
	{ stdio: "ignore" },
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 等待 CDP 端点就绪
let target: { webSocketDebuggerUrl: string } | undefined;
for (let i = 0; i < 60 && !target; i++) {
	await sleep(500);
	try {
		const created = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(ORIGIN)}`, {
			method: "PUT",
		});
		if (created.ok) target = (await created.json()) as { webSocketDebuggerUrl: string };
	} catch {
		/* not up yet */
	}
}
if (!target) {
	console.error("Chrome CDP 未就绪");
	chrome.kill();
	process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
	ws.addEventListener("open", () => resolve());
	ws.addEventListener("error", () => reject(new Error("CDP socket error")));
});

let nextId = 0;
const pending = new Map<number, (value: any) => void>();
ws.addEventListener("message", (message) => {
	const frame = JSON.parse(String(message.data)) as { id?: number; result?: unknown; error?: unknown };
	if (typeof frame.id === "number") pending.get(frame.id)?.({ result: frame.result, error: frame.error });
});

function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
	const id = ++nextId;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		ws.send(JSON.stringify({ id, method, params }));
	});
}

async function evaluate(expression: string): Promise<any> {
	const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
	if (response.error) throw new Error(JSON.stringify(response.error));
	const result = response.result;
	if (result?.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
	return result?.result?.value;
}

async function waitFor(expression: string, timeoutMs = 60_000): Promise<boolean> {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			if (await evaluate(expression)) return true;
		} catch {
			/* page still navigating */
		}
		await sleep(400);
	}
	return false;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: ORIGIN });
await sleep(1500);

// --- 1. 设计器落地页 ---
log("1. 落地页出现 workspace 列表", await waitFor(`document.querySelectorAll(".workspace-entry").length > 0`));

// --- 2. 打开 workspace demo ---
await evaluate(
	`(() => { const entries = [...document.querySelectorAll(".workspace-entry")]; const demo = entries.find((el) => el.textContent.includes("demo")); demo?.click(); return Boolean(demo); })()`,
);
log("2. 工作目录打开（会话 ready）", await waitFor(`document.querySelector(".preview-page") !== null`, 90_000));

// --- 3. 文件树 + 预览渲染 ---
log("3. 文件树列出页面与素材", await waitFor(`document.querySelectorAll(".filetree-item").length >= 2`));
log(
	"4. 预览容器已渲染 Agent 修改后的内容",
	await waitFor(`(document.querySelector("#preview-container")?.textContent ?? "").includes("Acceptance OK")`, 60_000),
);

// --- 4. 组件选中开关 ---
await evaluate(`document.querySelector(".select-toggle input")?.click()`);
log("5. 组件选中开关已打开", await evaluate(`document.querySelector(".select-toggle input")?.checked === true`));

// --- 5. 单击选中 Header 组件 ---
await evaluate(
	`document.querySelector("#preview-container .site-title")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
);
log("6. 单击选中组件并弹出浮层", await waitFor(`document.querySelector(".selection-menu") !== null`, 10_000));
const selected = await evaluate(`document.querySelector(".selection-file")?.textContent ?? ""`);
log("7. 浮层显示 data-fileName", selected === "Components/Header.jsx", selected);

// --- 6. Add To Context → chips ---
await evaluate(`document.querySelector(".selection-menu .button")?.click()`);
log("8. chips 注入对话输入区", await waitFor(`document.querySelector(".chip-path") !== null`, 10_000));
const chip = await evaluate(`document.querySelector(".chip-path")?.textContent ?? ""`);
log("9. chip 路径正确", chip === "Components/Header.jsx", chip);

// --- 7. 截图留证 ---
const shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) {
	fs.writeFileSync(`${import.meta.dir}/acceptance-screenshot.png`, Buffer.from(shot.result.data, "base64"));
	log("10. 截图已保存 acceptance-screenshot.png", true);
}

ws.close();
chrome.kill();
await sleep(1500);
try {
	fs.rmSync(PROFILE, { recursive: true, force: true });
} catch {
	// Windows 下 Chrome 退出后短暂持有 profile 文件锁，忽略即可
}
console.log(process.exitCode ? "\nUI 验收失败" : "\nUI 验收通过");
