import React from "react";

/**
 * 详情页「返回上一页」
 * 原实现为 href="javascript:history.back()"；React 中改为先尝试回退，
 * 无历史记录（直接打开详情页）时回退到列表页
 */
export default function BackLink({ fallbackHref = "./index.html" }) {
  return (
    <a
      data-fileName="Components/BackLink.jsx"
      className="back-link"
      href={fallbackHref}
      onClick={(event) => {
        event.preventDefault();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = fallbackHref;
        }
      }}
    >
      ‹ 返回上一页
    </a>
  );
}
