/* ============================================================
   漏洞发布平台 — 数据文件 v0.4（ESM 版）
   ------------------------------------------------------------
   使用方式（给不写代码的同事）：
   1. 用 Excel 整理漏洞信息，按下方字段导出/另存为本文件
   2. 直接替换本文件即可更新页面内容，无需改动其他代码
   ------------------------------------------------------------
   数据来源：HMBU安全漏洞管理表.xlsx - 安全通告子表（真实数据 3 条）
   字段映射（安全通告 advisory，对齐首页目标.md 六列）：
     detailTitle 详情页标题（xlsx 无对应列，人工概括自漏洞描述）
     desc       漏洞描述（列表截断显示，详情页展示全文）
     internalNo 内部编号（PMCSVD-年份-序号）
     cveNo      漏洞编号（CVE-xxxx-xxxxx）
     cvss       CVSS3评分
     level      漏洞等级：high=高 | medium=中 | low=低
     status     当前状态：processed=已处理 | processing=处理中 | unprocessed=未处理
     date       发布时间 YYYY-MM-DD（为空 = 未发布，列表显示 "-"）
   详情页扩展字段（detail.jsx 使用）：
     impact     漏洞描述及影响
     affected   受影响的产品及影响版本和修复版本（产品线）
     fix        修复方式
     confirm    更新确认（更新方式和检查是否更新）
   字段说明（安全公告 bulletin，对齐首页目标.md 三列；子表暂无真实数据，保留占位示例）：
     title      漏洞标题（安全公告.漏洞标题）
     internalId 内部标识（安全公告.内部标识）
     date       发布时间（安全公告.发布时间）
   ============================================================ */

export const VULN_DATA = {

  // ---------- 安全通告（SA）：真实数据，来自 HMBU安全漏洞管理表.xlsx ----------
  advisories: [
    {
      detailTitle: "zlib 堆缓冲区溢出漏洞",
      desc: "zlib 1.2.11 through 1.3.2 contains a heap buffer overflow: after an underlying write() fails, gz_write() returns without resetting strm.next_in, leaving it pointed at the caller's buffer. A later gz* write call then derives a position from the stale pointer and writes past a heap allocation; any write() failure reaches it, including EPIPE on a blocking descriptor, and in versions before 1.3.1.2 the failed write must be followed by a gzclearerr() call.",
      internalNo: "PMCSVD-2026-0002",
      cveNo: "CVE-2026-76844",
      cvss: "7.4",
      level: "high",
      status: "processed",
      date: "2026-10-09",
      impact: "存在漏洞：受影响区间 zlib 1.2.11–1.3.2，装置版本 1.2.11 落在区间内；已安装 usr/lib/libz.so.1.2.11，编译为标准 configure/make，未裁剪 gz* 写路径",
      affected: "1、iMeter 5  V1.01.01 V1.01.02及之后版本",
      fix: "升级 zlib 至官方修复版本（>1.3.2，建议直接取最新稳定版），重新编译并回归 libz.so 的 gz 读写功能",
      confirm: "1、imeter 5获取最新固件（链接），按照升级指导文档升级（通过web升级，升级后通过web查看版本）"
    },
    {
      detailTitle: "OpenSSL DTLS 1.2 AEAD 拒绝服务漏洞",
      desc: "Issue summary: An established DTLS 1.2 association using an AEAD cipher suite can be terminated by a single unauthenticated datagram whose encrypted fragment is shorter than the mandatory explicit IV and ",
      internalNo: "PMCSVD-2026-0003",
      cveNo: "CVE-2026-75806",
      cvss: "5.3",
      level: "medium",
      status: "processing",
      date: "2026-10-09",
      impact: "装置无dtls业务，暂不受影响",
      affected: "1、iMeter 5  V1.01.01 V1.01.02及之后版本",
      fix: "在 Configure 追加 no-dtls1_2 重新编译作为临时缓解",
      confirm: "1、imeter 5获取最新固件（链接），按照升级指导文档升级（通过web升级，升级后通过web查看版本）"
    },
    {
      detailTitle: "strongSwan PKCS#5 解密无限循环漏洞",
      desc: "strongSwan 4.6.2 through 6.0.7 has an infinite loop in PKCS#5 decryption.",
      internalNo: "PMCSVD-2026-0001",
      cveNo: "CVE-2026-78129",
      cvss: "5.9",
      level: "medium",
      status: "unprocessed",
      date: "",
      impact: "触发需加载 PKCS#5 加密的私钥，在使用PKCS#5 秘钥场景有影响",
      affected: "暂无",
      fix: "升级至6.1.0",
      confirm: "暂无"
    }
  ],

  // ---------- 安全公告（SN）：安全公告子表暂无真实数据，保留结构占位示例 ----------
  bulletins: [
    {
      title: "关于OpenSSL组件安全版本更新的声明",
      internalId: "sec-sn-2025-00006",
      date: "2025-06-10"
    },
    {
      title: "关于Spring Framework路径解析漏洞CVE-2025-29853的声明",
      internalId: "sec-sn-2025-00005",
      date: "2025-05-27"
    },
    {
      title: "关于Nginx HTTP/2拒绝服务漏洞的声明",
      internalId: "sec-sn-2025-00004",
      date: "2025-05-13"
    },
    {
      title: "关于Log4j2历史漏洞回归排查结果的声明",
      internalId: "sec-sn-2025-00003",
      date: "2025-04-22"
    },
    {
      title: "关于Chrome浏览器高危漏洞的安全提醒",
      internalId: "sec-sn-2024-00002",
      date: "2024-12-05"
    }
  ]
};

export default VULN_DATA;
