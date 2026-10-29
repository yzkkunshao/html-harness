import React from "react";

/**
 * 站点主导航（两个页面共用）
 * 原 index.html / detail.html 中的白色主导航 header
 */
export default function SiteHeader() {
  return (
    <header data-fileName="Components/SiteHeader.jsx" className="main-header">
      <div className="wrap header-inner">
        <a className="logo" href="./index.html">
          <div className="logo-mark">漏</div>
          <div className="logo-text">
            漏洞发布平台
            <small>Vulnerability Disclosure Platform</small>
          </div>
        </a>
      </div>
    </header>
  );
}
