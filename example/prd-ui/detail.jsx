import React from "react";
import { VULN_DATA } from "./data.js";
import SiteHeader from "./Components/SiteHeader.jsx";
import Breadcrumb from "./Components/Breadcrumb.jsx";
import BackLink from "./Components/BackLink.jsx";
import SeverityChip from "./Components/SeverityChip.jsx";
import { severityMeta } from "./Components/SeverityText.jsx";
import MetaGrid from "./Components/MetaGrid.jsx";
import DetailSection from "./Components/DetailSection.jsx";
import SiteFooter from "./Components/SiteFooter.jsx";

/**
 * 页面2：漏洞详情（根素材）
 * 原 detail.html 为硬编码；此处改为读取 data.js 首条安全通告，
 * 字段对应关系见「数据来源映射.md」
 */
const item = VULN_DATA.advisories[0];

const BREADCRUMB = [
  { label: "首页", href: "./index.html" },
  { label: "安全通告" },
  { label: "漏洞详情" }
];

const FOOTER_NOTE = "漏洞发布平台 · 原型 v0.4（页面1：安全通知 / 页面2：漏洞详情） · 仅供设计评审参考";
const FOOTER_REFERENCE = {
  label: "详情版式参考：",
  text: "trust.mi.com 漏洞通告",
  href: "https://trust.mi.com/zh-CN/misrc/bulletins/advisory?cveId=558"
};

export default function DetailPage() {
  const severity = severityMeta(item.level);

  const metaItems = [
    { label: "内部标识", value: item.internalNo },
    { label: "CVE编号", value: item.cveNo },
    { label: "CVSS分数", value: item.cvss },
    { label: "漏洞等级", value: severity.text, valueClassName: `sev-text ${severity.cls}` },
    { label: "发布时间", value: item.date }
  ];

  return (
    <div data-fileName="detail.jsx" className="page page-detail">
      <SiteHeader />
      <Breadcrumb items={BREADCRUMB} />

      <main className="main-section">
        <div className="wrap detail-wrap">
          <BackLink />

          <div className="detail-title-row">
            <h1 className="detail-title">{item.detailTitle}</h1>
            <SeverityChip level={item.level} />
          </div>

          <MetaGrid items={metaItems} />

          <DetailSection title="漏洞描述及影响">
            <p>{item.desc}</p>
            <p>{item.impact}</p>
          </DetailSection>

          <DetailSection title="受影响产品及修复">
            <p>{item.affected}</p>
            <p className="sub-h">修复方式</p>
            <p>{item.fix}</p>
          </DetailSection>

          <DetailSection title="更新确认（更新方式和检查是否更新）">
            <p>{item.confirm}</p>
          </DetailSection>
        </div>
      </main>

      <SiteFooter note={FOOTER_NOTE} reference={FOOTER_REFERENCE} />
    </div>
  );
}
