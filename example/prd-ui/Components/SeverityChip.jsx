import React from "react";
import { severityMeta } from "./SeverityText.jsx";

/**
 * 漏洞等级徽章（详情页标题右侧）
 * 原 detail.html 中的 .sev-chip.c-high / c-medium / c-low
 */
const CHIP_CLASS = {
  high: "c-high",
  medium: "c-medium",
  low: "c-low"
};

export default function SeverityChip({ level }) {
  const severity = severityMeta(level);
  return (
    <span
      data-fileName="Components/SeverityChip.jsx"
      className={`sev-chip ${CHIP_CLASS[level] || ""}`}
    >
      {severity.text}
    </span>
  );
}
