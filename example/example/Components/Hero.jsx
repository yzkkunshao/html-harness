// Components/Hero.jsx —— 首屏素材（标题 / 主按钮 / 数据条）
import React, { useRef, useState } from "react";

const stats = [
  { value: "0", label: "构建步骤" },
  { value: "1", label: "页面入口文件" },
  { value: "100%", label: "浏览器内编译" },
];

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  // 复制启动命令，给用户一个即时反馈
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText("node server.js");
    } catch (error) {
      // 剪贴板不可用时静默降级，不影响按钮反馈
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section id="top" data-fileName="Components/Hero.jsx" className="demo-hero">
      <span className="demo-badge demo-rise">
        <span className="demo-badge-dot" aria-hidden="true" />
        React 19 · JSX 运行时编译 · 无需脚手架
      </span>

      <h1 className="demo-hero-title demo-rise" style={{ animationDelay: "60ms" }}>
        把想法，直接变成
        <br />
        <span className="demo-grad">可交互的页面</span>
      </h1>

      <p className="demo-hero-desc demo-rise" style={{ animationDelay: "120ms" }}>
        一个由 Agent 驱动的前端原型设计器。写 JSX、保存、刷新，
        页面立即呈现——没有 npm install，没有打包等待，也没有构建配置。
      </p>

      <div className="demo-hero-actions demo-rise" style={{ animationDelay: "180ms" }}>
        <a className="demo-btn demo-btn-primary" href="#features">
          查看核心能力
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <button type="button" className="demo-btn demo-btn-ghost" onClick={handleCopy}>
          {copied ? "已复制 ✓" : "复制启动命令"}
        </button>
      </div>

      <p className="demo-hero-note demo-rise" style={{ animationDelay: "220ms" }}>
        无需依赖安装 · 纯静态服务 · 默认端口 5600
      </p>

      <div className="demo-stats demo-rise" style={{ animationDelay: "280ms" }}>
        {stats.map((item) => (
          <div className="demo-stat" key={item.label}>
            <div className="demo-stat-value">{item.value}</div>
            <div className="demo-stat-label">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
