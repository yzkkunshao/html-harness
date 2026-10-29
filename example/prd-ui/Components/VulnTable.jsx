import React from "react";
import SeverityText from "./SeverityText.jsx";

/**
 * 漏洞列表表格（斑马纹）
 * tab = "advisory" → 安全通告 6 列；tab = "bulletin" → 安全公告 3 列
 * 列结构以首页目标.md 为准：
 *   SA：漏洞描述 | 内部编号 | 漏洞编号 | CVSS3评分 | 漏洞等级 | 发布时间
 *   SN：漏洞标题 | 内部标识 | 发布时间
 */
const ADVISORY_HEAD = ["漏洞描述", "内部编号", "漏洞编号", "CVSS3评分", "漏洞等级", "发布时间"];
const BULLETIN_HEAD = ["漏洞标题", "内部标识", "发布时间"];

export default function VulnTable({ tab, rows, onOpenDetail, onPending }) {
  const isAdvisory = tab === "advisory";
  const mode = isAdvisory ? "sa" : "sn";
  const head = isAdvisory ? ADVISORY_HEAD : BULLETIN_HEAD;

  return (
    <div data-fileName="Components/VulnTable.jsx" className="vul-table">
      <div className={`vt-head ${mode}`}>
        {head.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-tip">暂无符合条件的记录</div>
      ) : (
        rows.map((item) =>
          isAdvisory ? (
            <div
              key={item.internalNo}
              className="vt-row sa"
              data-id={item.internalNo}
              onClick={() => onOpenDetail(item)}
            >
              <div>
                <a
                  className="row-desc"
                  href="./detail.html"
                  title="点击查看漏洞详情"
                  onClick={(event) => event.stopPropagation()}
                >
                  {item.desc}
                </a>
              </div>
              <div className="col-mono">{item.internalNo}</div>
              <div className="col-mono">{item.cveNo}</div>
              <div>{item.cvss}</div>
              <SeverityText level={item.level} />
              <div className="col-date">{item.date || "-"}</div>
            </div>
          ) : (
            <div
              key={item.internalId}
              className="vt-row sn"
              data-id={item.internalId}
              onClick={() => onPending(item.internalId)}
            >
              <div>
                <a className="row-title" title="点击查看详情（二级页面待设计）">
                  {item.title}
                </a>
              </div>
              <div className="col-mono">{item.internalId}</div>
              <div className="col-date">{item.date}</div>
            </div>
          )
        )
      )}
    </div>
  );
}
