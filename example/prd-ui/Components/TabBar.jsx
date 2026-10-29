import React from "react";

/**
 * 居中 Tab 切换（安全通告 / 安全公告）
 * tabs: [{ key, label }]
 */
export default function TabBar({ tabs, active, onChange }) {
  return (
    <div data-fileName="Components/TabBar.jsx" className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          className={tab.key === active ? "tab-item active" : "tab-item"}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
