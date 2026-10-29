import React from "react";

/**
 * 站点页脚（两个页面共用）
 * note      底部左侧版本说明
 * reference { label, text, href } 底部右侧参考链接
 * onPending 占位入口点击回调（可选，详情页不传则无响应）
 */
const COLUMNS = [
  { title: "关于平台", links: ["平台说明", "漏洞管理策略", "漏洞处理流程"] },
  { title: "相关链接", links: ["漏洞上报", "订阅管理", "CVRF 下载"] },
  { title: "技术支持", links: ["安全应急响应", "常见问题"] }
];

export default function SiteFooter({ note, reference, onPending }) {
  return (
    <footer data-fileName="Components/SiteFooter.jsx" className="site-footer">
      <div className="wrap footer-cols">
        {COLUMNS.map((column) => (
          <div className="f-col" key={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((name) => (
              <a
                key={name}
                href="#"
                className="js-pending"
                data-name={name}
                onClick={(event) => {
                  event.preventDefault();
                  onPending?.(name);
                }}
              >
                {name}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="wrap footer-bottom">
        <span>{note}</span>
        <span>
          {reference.label}
          <a href={reference.href} target="_blank" rel="noopener">
            {reference.text}
          </a>
        </span>
      </div>
    </footer>
  );
}
