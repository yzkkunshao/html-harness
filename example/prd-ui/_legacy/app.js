/* ============================================================
   漏洞发布平台 — 页面渲染逻辑 v0.2（纯原生 JS，无依赖）
   对齐参考站交互：Tab 切换 / 关键字+高级搜索 / 排序 / 斑马纹表格 / 分页跳页
   ============================================================ */

(function () {
  "use strict";

  var PAGE_SIZE = 10; // 每页条数（参考站一页条目较多）
  var state = {
    tab: "advisory",     // advisory=安全通告(SA) | bulletin=安全公告(SN)
    keyword: "",         // 已生效的关键字
    year: "", severity: "", status: "",
    sort: "date",        // date=发布时间 | title=标题
    page: 1
  };

  // 漏洞等级（取自 HMBU安全漏洞管理表-安全通告-漏洞等级：高/中/低）
  var SEVERITY = {
    high:   { text: "高", cls: "sev-high" },
    medium: { text: "中", cls: "sev-medium" },
    low:    { text: "低", cls: "sev-low" }
  };

  // ---------- 工具 ----------
  function $(sel) { return document.querySelector(sel); }
  // 元素存在才绑定事件：搜索/排序等可选区块可能被注释屏蔽（需求：搜索功能不做），不可让缺失区块阻断启动
  function on(sel, event, fn) {
    var el = $(sel);
    if (el) el.addEventListener(event, fn);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  // ---------- 数据过滤 + 排序 ----------
  function getData() {
    var all = state.tab === "advisory"
      ? window.VULN_DATA.advisories
      : window.VULN_DATA.bulletins;

    var list = all.filter(function (it) {
      if (state.year && (it.date || "").indexOf(state.year) !== 0) return false;
      if (state.severity && it.level !== state.severity) return false;
      if (state.tab === "advisory" && state.status && it.status !== state.status) return false;
      if (state.keyword) {
        var kw = state.keyword.toLowerCase();
        var hay = ((it.desc || "") + (it.internalNo || "") + (it.cveNo || "") + (it.title || "") + (it.internalId || "")).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });

    // 排序：发布时间倒序（空日期靠后）/ 内部编号升序
    list.sort(function (a, b) {
      if (state.sort === "no") return (a.internalNo || a.internalId || "").localeCompare(b.internalNo || b.internalId || "");
      return (a.date || "") < (b.date || "") ? 1 : -1;
    });
    return list;
  }

  // 年份下拉选项（根据数据自动生成；搜索屏蔽时跳过）
  function initYearOptions() {
    var select = $("#filter-year");
    if (!select) return;
    var years = {};
    window.VULN_DATA.advisories.concat(window.VULN_DATA.bulletins).forEach(function (it) {
      var y = (it.date || "").slice(0, 4);
      if (y) years[y] = true;
    });
    var html = '<option value="">全部年份</option>';
    Object.keys(years).sort().reverse().forEach(function (y) {
      html += '<option value="' + y + '">' + y + ' 年</option>';
    });
    select.innerHTML = html;
  }

  // ---------- 渲染：表格（SA 六列 / SN 三列，对齐参考站列结构） ----------
  function renderTable() {
    var isAdv = state.tab === "advisory";
    var data = getData();
    var totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var rows = data.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    // 列头以首页目标.md 为准：漏洞描述 | 内部编号 | 漏洞编号 | CVSS3评分 | 漏洞等级 | 发布时间
    var html = isAdv
      ? '<div class="vt-head sa"><div>漏洞描述</div><div>内部编号</div><div>漏洞编号</div><div>CVSS3评分</div><div>漏洞等级</div><div>发布时间</div></div>'
      : '<div class="vt-head sn"><div>漏洞标题</div><div>内部标识</div><div>发布时间</div></div>';

    if (!rows.length) {
      html += '<div class="empty-tip">暂无符合条件的记录</div>';
    } else {
      html += rows.map(function (it) {
        var cls = isAdv ? "sa" : "sn";

        if (isAdv) {
          // SA 六列：漏洞描述(链接) | 内部编号 | 漏洞编号 | CVSS3评分 | 漏洞等级 | 发布时间
          var sev = SEVERITY[it.level] || { text: it.level, cls: "" };
          var descCell =
            '<a class="row-desc" href="漏洞详情.html" title="点击查看漏洞详情">' + esc(it.desc) + "</a>";
          return (
            '<div class="vt-row ' + cls + '" data-id="' + esc(it.internalNo) + '">' +
              "<div>" + descCell + "</div>" +
              '<div class="col-mono">' + esc(it.internalNo) + "</div>" +
              '<div class="col-mono">' + esc(it.cveNo) + "</div>" +
              "<div>" + esc(it.cvss) + "</div>" +
              '<div class="sev-text ' + sev.cls + '">' + sev.text + "</div>" +
              '<div class="col-date">' + (esc(it.date) || "-") + "</div>" +
            "</div>"
          );
        }

        // SN 三列（以首页目标.md 为准）：漏洞标题 | 内部标识 | 发布时间
        var titleCell =
          '<a class="row-title" title="点击查看详情（二级页面待设计）">' + esc(it.title) + "</a>";
        return (
          '<div class="vt-row ' + cls + '" data-id="' + esc(it.internalId) + '">' +
            "<div>" + titleCell + "</div>" +
            '<div class="col-mono">' + esc(it.internalId) + "</div>" +
            '<div class="col-date">' + esc(it.date) + "</div>" +
          "</div>"
        );
      }).join("");
    }

    $("#vul-table").innerHTML = html;
    renderPager(totalPages, data.length);
  }

  // ---------- 渲染：分页（共 N 条 + 页码 + 前往第 X 页） ----------
  function renderPager(totalPages, total) {
    var html = "<span>共 " + total + " 条</span>";
    html += pageBtn(state.page - 1, "&lsaquo;", state.page <= 1);
    html += pageNums(totalPages);
    html += pageBtn(state.page + 1, "&rsaquo;", state.page >= totalPages);
    html += '<span class="jump-label">前往第</span><input class="jump-input" id="jump-input" value="' + state.page + '"><span>页</span>';
    $("#pager").innerHTML = html;
  }

  function pageBtn(go, label, disabled) {
    return '<button class="page-btn" data-go="' + go + '"' + (disabled ? " disabled" : "") + ">" + label + "</button>";
  }

  // 页码序列：1 … 中间5个 … 末页
  function pageNums(totalPages) {
    var out = "", start, end;
    if (totalPages <= 7) {
      start = 1; end = totalPages;
    } else {
      start = Math.max(1, state.page - 2);
      end = Math.min(totalPages, start + 4);
      if (end - start < 4) start = end - 4;
    }
    if (start > 1) { out += pageBtn(1, "1", false); if (start > 2) out += '<span class="ellipsis">…</span>'; }
    for (var i = start; i <= end; i++) {
      out += '<button class="page-btn' + (i === state.page ? " active" : "") + '" data-go="' + i + '">' + i + "</button>";
    }
    if (end < totalPages) {
      if (end < totalPages - 1) out += '<span class="ellipsis">…</span>';
      out += pageBtn(totalPages, totalPages, false);
    }
    return out;
  }

  function renderAll() { renderTable(); }

  // 应用查询（读取关键字与高级搜索面板条件）
  function applyQuery() {
    state.keyword = $("#q-keyword").value.trim();
    state.year = $("#filter-year").value;
    state.severity = $("#filter-severity").value;
    state.status = $("#filter-status").value;
    state.page = 1;
    renderTable();
  }

  // ---------- 事件绑定 ----------
  function bind() {
    // Tab 切换：SA 有漏洞等级列；SN 不分级，禁用等级/状态筛选
    on("#tab-advisory", "click", function () {
      state.tab = "advisory"; state.page = 1;
      $("#tab-advisory").classList.add("active");
      $("#tab-bulletin").classList.remove("active");
      var fs = $("#filter-status"), sv = $("#filter-severity");
      if (fs) fs.disabled = false;
      if (sv) sv.disabled = false;
      renderTable();
    });
    on("#tab-bulletin", "click", function () {
      state.tab = "bulletin"; state.page = 1;
      $("#tab-bulletin").classList.add("active");
      $("#tab-advisory").classList.remove("active");
      var fs = $("#filter-status"), sv = $("#filter-severity");
      if (fs) { fs.disabled = true; fs.value = ""; }
      if (sv) { sv.disabled = true; sv.value = ""; }
      state.status = ""; state.severity = "";
      renderTable();
    });

    // 高级搜索折叠（搜索屏蔽时不绑定）
    on("#q-adv-toggle", "click", function () {
      var panel = $("#q-adv-panel");
      if (!panel) return;
      panel.classList.toggle("hidden");
      var arrow = $("#q-adv-arrow");
      if (arrow) arrow.textContent = panel.classList.contains("hidden") ? "⌄" : "⌃";
    });

    // 查询 / 重置（搜索屏蔽时不绑定）
    on("#btn-query", "click", applyQuery);
    on("#q-keyword", "keydown", function (e) { if (e.key === "Enter") applyQuery(); });
    on("#btn-reset", "click", function () {
      var kw = $("#q-keyword");
      if (kw) kw.value = "";
      var fy = $("#filter-year"), fv = $("#filter-severity"), fs = $("#filter-status");
      if (fy) fy.value = "";
      if (fv) fv.value = "";
      if (fs) fs.value = "";
      state.keyword = state.year = state.severity = state.status = "";
      state.page = 1;
      renderTable();
    });

    // 排序（排序栏屏蔽时不绑定）
    on("#sort-select", "change", function (e) {
      state.sort = e.target.value;
      renderTable();
    });

    // 分页点击 + 跳页
    on("#pager", "click", function (e) {
      var btn = e.target.closest(".page-btn");
      if (!btn || btn.disabled) return;
      state.page = parseInt(btn.dataset.go, 10);
      renderTable();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("#pager").addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target.id !== "jump-input") return;
      var p = parseInt(e.target.value, 10);
      var total = Math.max(1, Math.ceil(getData().length / PAGE_SIZE));
      if (p >= 1 && p <= total) { state.page = p; renderTable(); }
    });

    // 行点击：SA → 漏洞详情页（需求：点击漏洞描述可看到）；SN → 占位提示
    $("#vul-table").addEventListener("click", function (e) {
      var row = e.target.closest(".vt-row");
      if (!row) return;
      if (row.classList.contains("sa")) {
        window.location.href = "漏洞详情.html";
      } else {
        toast("「" + row.dataset.id + "」详情页为二级跳转页面，本期原型暂不包含");
      }
    });

    // 漏洞上报 / 漏洞处理流程（导航、底部卡片两处入口）
    [["js-entry-report", "漏洞上报"], ["js-entry-process", "漏洞处理流程"]].forEach(function (pair) {
      document.querySelectorAll("." + pair[0]).forEach(function (el) {
        el.addEventListener("click", function () {
          toast("「" + pair[1] + "」页面为二级跳转页面，本期原型暂不包含");
        });
      });
    });

    // 其余占位元素（顶条/浮动按钮/页脚/横幅按钮）
    document.querySelectorAll(".js-pending").forEach(function (el) {
      el.addEventListener("click", function () {
        toast("「" + (el.dataset.name || "该功能") + "」为占位入口，本期原型暂不实现");
      });
    });
  }

  // ---------- 启动 ----------
  document.addEventListener("DOMContentLoaded", function () {
    initYearOptions();
    renderAll();
    bind();
  });
})();
