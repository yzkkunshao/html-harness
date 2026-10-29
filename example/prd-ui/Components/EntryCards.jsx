import React from "react";

/**
 * 列表下方两个入口卡片（对齐参考站：白底描边两列）
 * 本期为二级页面占位，点击由根素材给出 Toast 提示
 */
const CARDS = [
  {
    key: "report",
    className: "js-entry-report",
    title: "漏洞上报",
    desc: "漏洞上报者可以通过邮箱向安全团队提交潜在的安全漏洞"
  },
  {
    key: "process",
    className: "js-entry-process",
    title: "漏洞处理流程",
    desc: "安全团队按照漏洞处理流程对上报的潜在漏洞进行处理"
  }
];

export default function EntryCards({ onPending }) {
  return (
    <div data-fileName="Components/EntryCards.jsx" className="entry-cards">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`entry-card ${card.className}`}
          title="二级页面，本期原型占位"
          onClick={() => onPending(card.title)}
        >
          <h3>
            {card.title} <span className="badge-pending">待设计</span>
          </h3>
          <p>{card.desc}</p>
        </div>
      ))}
    </div>
  );
}
