// App.jsx —— 页面根素材：演示首页
// 说明：页面级样式以 <style> 方式随根素材注入，
// 保证「交付物运行时」与「沙盒运行时（Bun import）」表现一致。
import React from "react";
import SiteHeader from "./Components/SiteHeader.jsx";
import Hero from "./Components/Hero.jsx";
import FeatureGrid from "./Components/FeatureGrid.jsx";
import Workflow from "./Components/Workflow.jsx";
import SiteFooter from "./Components/SiteFooter.jsx";

const pageCss = `
/* ============ 基础重置（页面级） ============ */
html, body { margin: 0; padding: 0; background: #080a10; }
#root { isolation: isolate; }

/* ============ 设计令牌 ============ */
.demo-root {
  --demo-bg: #080a10;
  --demo-surface: rgba(255, 255, 255, 0.035);
  --demo-surface-strong: rgba(255, 255, 255, 0.06);
  --demo-border: rgba(255, 255, 255, 0.09);
  --demo-text: #eef1f7;
  --demo-muted: #98a2b8;
  --demo-accent: #7c5cff;
  --demo-accent-soft: #a78bfa;
  --demo-accent-2: #22d3c5;
  --demo-radius: 16px;
  min-height: 100vh;
  color: var(--demo-text);
  background:
    radial-gradient(880px 520px at 10% -10%, rgba(124, 92, 255, 0.22), transparent 62%),
    radial-gradient(720px 460px at 92% 2%, rgba(34, 211, 197, 0.13), transparent 64%),
    var(--demo-bg);
  font-family: "Inter", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei",
    system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.demo-root *,
.demo-root *::before,
.demo-root *::after { box-sizing: border-box; }
.demo-root ::selection { background: rgba(124, 92, 255, 0.35); color: #fff; }

/* ============ 通用容器 ============ */
.demo-container {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ============ 顶栏 ============ */
.demo-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(8, 10, 16, 0.7);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid var(--demo-border);
}
.demo-header-inner { display: flex; align-items: center; gap: 24px; height: 66px; }
.demo-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--demo-text);
  text-decoration: none;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.demo-brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--demo-accent), var(--demo-accent-2));
  box-shadow: 0 8px 20px rgba(124, 92, 255, 0.45);
  color: #fff;
}
.demo-brand-name { font-size: 15px; }
.demo-brand-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--demo-accent-soft);
  border: 1px solid rgba(167, 139, 250, 0.35);
  background: rgba(124, 92, 255, 0.12);
  padding: 2px 7px;
  border-radius: 999px;
}
.demo-nav { display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.demo-nav-link {
  color: var(--demo-muted);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 9px;
  transition: color 0.18s ease, background 0.18s ease;
}
.demo-nav-link:hover { color: var(--demo-text); background: var(--demo-surface); }
.demo-header-spacer { flex: 1; }
.demo-header-meta {
  font-size: 12.5px;
  color: var(--demo-muted);
  letter-spacing: 0.02em;
}

/* ============ 按钮 ============ */
.demo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 20px;
  border-radius: 11px;
  border: 1px solid transparent;
  font-size: 14.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}
.demo-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, #7c5cff 0%, #5b6bff 55%, #22d3c5 140%);
  box-shadow: 0 14px 32px -12px rgba(96, 88, 255, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
.demo-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px -14px rgba(96, 88, 255, 1),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
}
.demo-btn-ghost {
  color: var(--demo-text);
  background: var(--demo-surface);
  border-color: var(--demo-border);
}
.demo-btn-ghost:hover {
  transform: translateY(-2px);
  background: var(--demo-surface-strong);
  border-color: rgba(255, 255, 255, 0.2);
}
.demo-btn:focus-visible { outline: 2px solid var(--demo-accent-soft); outline-offset: 2px; }

/* ============ Hero ============ */
.demo-hero { position: relative; text-align: center; padding: 96px 24px 24px; }
.demo-hero::before {
  content: "";
  position: absolute;
  inset: auto 0 -40px;
  height: 280px;
  background: radial-gradient(600px 200px at 50% 0%, rgba(124, 92, 255, 0.16), transparent 70%);
  pointer-events: none;
}
.demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 6px 13px;
  border-radius: 999px;
  border: 1px solid var(--demo-border);
  background: var(--demo-surface);
  color: var(--demo-muted);
  font-size: 12.5px;
  letter-spacing: 0.01em;
}
.demo-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--demo-accent-2);
  box-shadow: 0 0 0 4px rgba(34, 211, 197, 0.14);
}
.demo-hero-title {
  margin: 24px 0 0;
  font-size: clamp(34px, 5.6vw, 60px);
  line-height: 1.06;
  letter-spacing: -0.035em;
  font-weight: 750;
}
.demo-grad {
  background: linear-gradient(100deg, #a78bfa, #7c5cff 45%, #22d3c5);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.demo-hero-desc {
  max-width: 620px;
  margin: 20px auto 0;
  font-size: clamp(15px, 1.4vw, 17px);
  line-height: 1.8;
  color: var(--demo-muted);
}
.demo-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
.demo-hero-note {
  margin-top: 18px;
  font-size: 12.5px;
  color: rgba(152, 162, 184, 0.75);
  letter-spacing: 0.02em;
}

/* ============ 数据条 ============ */
.demo-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 640px;
  margin: 46px auto 0;
}
.demo-stat {
  padding: 18px 12px;
  border-radius: 14px;
  border: 1px solid var(--demo-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
}
.demo-stat-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, #ffffff, #a9b4cc);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.demo-stat-label { margin-top: 4px; font-size: 12.5px; color: var(--demo-muted); }

/* ============ 区块 ============ */
.demo-section { padding: 72px 0 0; }
.demo-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.demo-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--demo-accent-soft);
}
.demo-section-title {
  margin: 10px 0 0;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  letter-spacing: -0.025em;
}
.demo-section-desc {
  margin: 0;
  max-width: 420px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--demo-muted);
}

/* ============ 能力卡片 ============ */
.demo-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.demo-card {
  position: relative;
  padding: 22px;
  border-radius: var(--demo-radius);
  border: 1px solid var(--demo-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012));
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
}
.demo-card:hover {
  transform: translateY(-4px);
  border-color: rgba(167, 139, 250, 0.34);
  background: linear-gradient(180deg, rgba(124, 92, 255, 0.1), rgba(255, 255, 255, 0.02));
  box-shadow: 0 22px 42px -26px rgba(0, 0, 0, 0.9);
}
.demo-card-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: #c7bcff;
  background: rgba(124, 92, 255, 0.14);
  border: 1px solid rgba(124, 92, 255, 0.28);
}
.demo-card-title {
  margin: 16px 0 0;
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.demo-card-desc {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.72;
  color: var(--demo-muted);
}
.demo-card-index {
  position: absolute;
  top: 22px;
  right: 22px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  color: rgba(152, 162, 184, 0.45);
}

/* ============ 工作流 ============ */
.demo-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.demo-step {
  position: relative;
  padding: 22px;
  border-radius: var(--demo-radius);
  border: 1px solid var(--demo-border);
  background: rgba(255, 255, 255, 0.025);
}
.demo-step-num {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--demo-accent-2);
}
.demo-step-title { margin: 12px 0 0; font-size: 16px; font-weight: 650; }
.demo-step-desc {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--demo-muted);
}
.demo-step code,
.demo-code-inline {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  color: #d9dcef;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--demo-border);
  padding: 1px 6px;
  border-radius: 6px;
}

/* ============ 代码面板 ============ */
.demo-code-panel {
  margin-top: 14px;
  border-radius: var(--demo-radius);
  border: 1px solid var(--demo-border);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}
.demo-code-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--demo-border);
  background: rgba(255, 255, 255, 0.02);
}
.demo-code-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 255, 255, 0.16); }
.demo-code-dot:nth-child(1) { background: rgba(255, 107, 107, 0.55); }
.demo-code-dot:nth-child(2) { background: rgba(255, 196, 87, 0.55); }
.demo-code-dot:nth-child(3) { background: rgba(74, 222, 128, 0.55); }
.demo-code-name {
  margin-left: 6px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--demo-muted);
}
.demo-code-block {
  margin: 0;
  padding: 18px 20px;
  overflow-x: auto;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.8px;
  line-height: 1.85;
  color: #c9d1e4;
}
.demo-code-key { color: #a78bfa; }
.demo-code-str { color: #7ee0d3; }
.demo-code-cmt { color: #5d6880; }

/* ============ 页脚 ============ */
.demo-footer {
  margin-top: 88px;
  border-top: 1px solid var(--demo-border);
  padding: 26px 0 34px;
}
.demo-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--demo-muted);
}
.demo-footer-links { display: flex; gap: 18px; }
.demo-footer-links a { color: var(--demo-muted); text-decoration: none; }
.demo-footer-links a:hover { color: var(--demo-text); }

/* ============ 入场动画 ============ */
@keyframes demo-rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.demo-rise { animation: demo-rise 0.72s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* ============ 响应式 ============ */
@media (max-width: 820px) {
  .demo-nav, .demo-header-meta { display: none; }
  .demo-hero { padding-top: 64px; }
  .demo-stats { grid-template-columns: 1fr 1fr 1fr; }
}
@media (max-width: 560px) {
  .demo-stats { grid-template-columns: 1fr; }
  .demo-section { padding-top: 56px; }
  .demo-footer { margin-top: 64px; }
}
@media (prefers-reduced-motion: reduce) {
  .demo-rise { animation: none; }
  .demo-card:hover, .demo-btn:hover { transform: none; }
}
`;

export default function App() {
  return (
    <div data-fileName="App.jsx" className="app-root demo-root">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <SiteHeader />
      <main className="demo-main">
        <Hero />
        <FeatureGrid />
        <Workflow />
      </main>
      <SiteFooter />
    </div>
  );
}
