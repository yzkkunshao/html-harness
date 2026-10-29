// Components/FeatureGrid.jsx —— 核心能力卡片网格素材
import React from "react";

const features = [
  {
    title: "运行时 JSX 编译",
    desc: "esm-x 接管模块加载，Babel 在浏览器里现场编译 JSX，保存文件即生效。",
    icon: (
      <>
        <path d="M9 6 4 12l5 6M15 6l5 6-5 6" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "组件即素材",
    desc: "每个 .jsx 都是可复用素材，通过相对路径互相 import，自由组合成页面。",
    icon: (
      <>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.7"
          strokeLinejoin="round" />
        <path d="M3 12l9 5 9-5M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "零依赖启动",
    desc: "node 原生静态服务器，不装包、不打包，一条命令即可打开预览。",
    icon: (
      <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "组件树导航",
    desc: "面板展示素材依赖树，点选即高亮，右键直达对应素材源码。",
    icon: (
      <>
        <path d="M6 4v16M6 9h7M6 15h7" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" />
        <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17" cy="15" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      </>
    ),
  },
  {
    title: "Add To Context",
    desc: "一键把素材路径注入对话，让 Agent 精准修改你正在看的那一行。",
    icon: (
      <>
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "双运行时一致",
    desc: "同一份素材，既能在浏览器里运行，也能被 Bun 通过 import(url) 直接加载。",
    icon: (
      <>
        <path d="M20 12a8 8 0 1 1-2.4-5.7" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" />
        <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" data-fileName="Components/FeatureGrid.jsx" className="demo-section">
      <div className="demo-container">
        <div className="demo-section-head">
          <div>
            <div className="demo-eyebrow">Capabilities</div>
            <h2 className="demo-section-title">为「快速试错」而生的基础设施</h2>
          </div>
          <p className="demo-section-desc">
            去掉脚手架和构建链路，只保留设计本身需要的东西。
          </p>
        </div>

        <div className="demo-features">
          {features.map((item, index) => (
            <article className="demo-card" key={item.title}>
              <span className="demo-card-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="demo-card-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  {item.icon}
                </svg>
              </span>
              <h3 className="demo-card-title">{item.title}</h3>
              <p className="demo-card-desc">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
