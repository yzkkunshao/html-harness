// Components/SiteHeader.jsx —— 顶部导航栏素材
import React from "react";

export default function SiteHeader() {
  return (
    <header data-fileName="Components/SiteHeader.jsx" className="demo-header">
      <div className="demo-container demo-header-inner">
        <a className="demo-brand" href="#top" aria-label="html-harness 演示首页">
          <span className="demo-brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.7 14.3 8 8 14.3 1.7 8Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="demo-brand-name">html-harness</span>
          <span className="demo-brand-tag">preview</span>
        </a>

        <nav className="demo-nav" aria-label="主导航">
          <a className="demo-nav-link" href="#features">核心能力</a>
          <a className="demo-nav-link" href="#workflow">工作流</a>
          <a className="demo-nav-link" href="#about">关于</a>
        </nav>

        <span className="demo-header-spacer" />
        <span className="demo-header-meta">零构建 · 秒级预览</span>
      </div>
    </header>
  );
}
