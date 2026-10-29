import React, { useEffect, useMemo, useState } from "react";
import { VULN_DATA } from "./data.js";
import SiteHeader from "./Components/SiteHeader.jsx";
import Breadcrumb from "./Components/Breadcrumb.jsx";
import TabBar from "./Components/TabBar.jsx";
import VulnTable from "./Components/VulnTable.jsx";
import Pager from "./Components/Pager.jsx";
import EntryCards from "./Components/EntryCards.jsx";
import SiteFooter from "./Components/SiteFooter.jsx";
import Toast from "./Components/Toast.jsx";

/**
 * 页面1：安全通知（根素材）
 * 职责：Tab / 分页 / 排序状态 + 数据切片 + 占位入口 Toast
 * 子素材：SiteHeader / Breadcrumb / TabBar / VulnTable / Pager / EntryCards / SiteFooter / Toast
 */
const PAGE_SIZE = 10;

const TABS = [
  { key: "advisory", label: "安全通告" },
  { key: "bulletin", label: "安全公告" }
];

const BREADCRUMB = [{ label: "首页", href: "./index.html" }, { label: "安全通知" }];

const FOOTER_NOTE = "漏洞发布平台 · 原型 v0.4（页面1：安全通知） · 仅供设计评审参考";
const FOOTER_REFERENCE = {
  label: "参考布局：",
  text: "securitybulletin.huawei.com",
  href: "https://securitybulletin.huawei.com/enterprise/cn/security-notice"
};

export default function App() {
  const [tab, setTab] = useState("advisory");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState({ id: 0, message: "" });

  const notify = (message) => {
    setToast((prev) => ({ id: prev.id + 1, message }));
  };

  // 2.2s 后自动收起；同一文案重复触发时 id 变化会重置计时
  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, message: "" }));
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast.id]);

  // 原 app.js：发布时间倒序（空日期靠后）
  const sortedRows = useMemo(() => {
    const source = tab === "advisory" ? VULN_DATA.advisories : VULN_DATA.bulletins;
    return [...source].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [tab]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setPage(1);
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 安全通告行 → 漏洞详情页；安全公告行仍为二级页面占位
  const handleOpenDetail = () => {
    window.location.href = "./detail.html";
  };

  const handleBulletinPending = (internalId) => {
    notify(`「${internalId}」详情页为二级跳转页面，本期原型暂不包含`);
  };

  return (
    <div data-fileName="App.jsx" className="page page-advisory">
      <SiteHeader />
      <Breadcrumb items={BREADCRUMB} />

      <main className="main-section">
        <div className="wrap">
          <h1 className="page-title">安全通知</h1>

          <TabBar tabs={TABS} active={tab} onChange={handleTabChange} />

          <VulnTable
            tab={tab}
            rows={pageRows}
            onOpenDetail={handleOpenDetail}
            onPending={handleBulletinPending}
          />

          <Pager
            page={currentPage}
            totalPages={totalPages}
            total={sortedRows.length}
            onChange={handlePageChange}
          />

          <EntryCards onPending={notify} />
        </div>
      </main>

      <SiteFooter note={FOOTER_NOTE} reference={FOOTER_REFERENCE} onPending={notify} />
      <Toast message={toast.message} />
    </div>
  );
}
