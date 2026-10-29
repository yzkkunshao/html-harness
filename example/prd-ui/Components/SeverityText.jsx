import React from "react";

/**
 * 漏洞等级（文本列，取自 HMBU安全漏洞管理表-安全通告-漏洞等级）
 * 同时导出映射表，供列表、详情页徽章、元信息行复用
 */
export const SEVERITY = {
  high: { text: "高", cls: "sev-high" },
  medium: { text: "中", cls: "sev-medium" },
  low: { text: "低", cls: "sev-low" }
};

export function severityMeta(level) {
  return SEVERITY[level] || { text: level || "", cls: "" };
}

export default function SeverityText({ level }) {
  const severity = severityMeta(level);
  return (
    <span data-fileName="Components/SeverityText.jsx" className={`sev-text ${severity.cls}`}>
      {severity.text}
    </span>
  );
}
