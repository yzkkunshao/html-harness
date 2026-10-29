import React from "react";

/**
 * 轻提示（替代原 app.js 里手动操作 DOM 的 toast）
 * message 为空字符串时不显示；CSS 的 .show 控制淡入淡出
 */
export default function Toast({ message }) {
  return (
    <div
      data-fileName="Components/Toast.jsx"
      className={message ? "toast show" : "toast"}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
