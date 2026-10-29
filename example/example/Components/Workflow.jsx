// Components/Workflow.jsx —— 工作流三步 + 目录结构代码面板素材
import React from "react";

const steps = [
  {
    num: "STEP 01",
    title: "编写素材",
    desc: (
      <>
        在 <code>Components/</code> 下新建 JSX 组件，根节点带上{" "}
        <code>data-fileName</code>。
      </>
    ),
  },
  {
    num: "STEP 02",
    title: "组合页面",
    desc: (
      <>
        在 <code>App.jsx</code> 中用相对路径 import，并把素材挂载进页面。
      </>
    ),
  },
  {
    num: "STEP 03",
    title: "实时预览",
    desc: "刷新浏览器即可看到结果，样式与交互都由素材自己负责。",
  },
];

export default function Workflow() {
  return (
    <section id="workflow" data-fileName="Components/Workflow.jsx" className="demo-section">
      <div className="demo-container">
        <div className="demo-section-head">
          <div>
            <div className="demo-eyebrow">Workflow</div>
            <h2 className="demo-section-title">三步，从代码到可见页面</h2>
          </div>
          <p className="demo-section-desc">
            页面结构天然就是组件结构，改动范围永远清晰。
          </p>
        </div>

        <div className="demo-steps">
          {steps.map((step) => (
            <div className="demo-step" key={step.num}>
              <div className="demo-step-num">{step.num}</div>
              <h3 className="demo-step-title">{step.title}</h3>
              <p className="demo-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="demo-code-panel">
          <div className="demo-code-bar">
            <span className="demo-code-dot" />
            <span className="demo-code-dot" />
            <span className="demo-code-dot" />
            <span className="demo-code-name">demo-page / App.jsx</span>
          </div>
          <pre className="demo-code-block">
            <code>
              <span className="demo-code-cmt">{"// 页面入口：只做挂载与组合"}</span>
              {"\n"}
              <span className="demo-code-key">import</span> Hero{" "}
              <span className="demo-code-key">from</span>{" "}
              <span className="demo-code-str">"./Components/Hero.jsx"</span>;
              {"\n"}
              <span className="demo-code-key">import</span> FeatureGrid{" "}
              <span className="demo-code-key">from</span>{" "}
              <span className="demo-code-str">"./Components/FeatureGrid.jsx"</span>;
              {"\n\n"}
              <span className="demo-code-key">export default function</span> App() {"{"}
              {"\n  "}
              <span className="demo-code-key">return</span> (
              {"\n    "}&lt;<span className="demo-code-key">main</span>{" "}
              <span className="demo-code-str">className</span>=
              <span className="demo-code-str">"demo-main"</span>&gt;
              {"\n      "}&lt;Hero /&gt;
              {"\n      "}&lt;FeatureGrid /&gt;
              {"\n    "}&lt;/<span className="demo-code-key">main</span>&gt;
              {"\n  "});
              {"\n}"}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
