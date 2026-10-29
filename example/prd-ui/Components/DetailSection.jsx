import React from "react";

/**
 * 详情页章节容器：标题 + 内容
 * 原 detail.html 中的 .detail-section
 */
export default function DetailSection({ title, children }) {
  return (
    <section data-fileName="Components/DetailSection.jsx" className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
