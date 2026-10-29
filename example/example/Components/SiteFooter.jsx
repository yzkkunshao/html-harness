// Components/SiteFooter.jsx —— 页脚素材
import React from "react";

export default function SiteFooter() {
  return (
    <footer id="about" data-fileName="Components/SiteFooter.jsx" className="demo-footer">
      <div className="demo-container demo-footer-inner">
        <span>html-harness · Agent 驱动的原型设计器</span>
        <nav className="demo-footer-links" aria-label="页脚导航">
          <a href="#features">核心能力</a>
          <a href="#workflow">工作流</a>
          <a href="#top">回到顶部</a>
        </nav>
        <span>React 19 · 浏览器内 Babel 编译</span>
      </div>
    </footer>
  );
}
