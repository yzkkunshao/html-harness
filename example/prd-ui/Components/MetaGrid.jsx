import React from "react";

/**
 * 详情页元信息行（小米式：label 上 / value 下）
 * items: [{ label, value, valueClassName? }]
 */
export default function MetaGrid({ items }) {
  return (
    <div data-fileName="Components/MetaGrid.jsx" className="meta-grid">
      {items.map((item) => (
        <div className="meta-item" key={item.label}>
          <div className="meta-label">{item.label}</div>
          <div className={item.valueClassName ? `meta-value ${item.valueClassName}` : "meta-value"}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
