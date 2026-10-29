import React from "react";

/**
 * 面包屑
 * items: [{ label, href }]，最后一项无 href 表示当前页
 */
export default function Breadcrumb({ items }) {
  return (
    <div data-fileName="Components/Breadcrumb.jsx" className="crumb-bar">
      <div className="wrap">
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="sep">|</span>}
            {item.href ? <a href={item.href}>{item.label}</a> : item.label}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
