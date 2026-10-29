import React, { useEffect, useState } from "react";

/**
 * 分页：共 N 条 + 页码 + 前往第 X 页
 * 页码序列沿用原实现：1 … 中间 5 个 … 末页
 */
function buildPageItems(current, totalPages) {
  let start;
  let end;
  if (totalPages <= 7) {
    start = 1;
    end = totalPages;
  } else {
    start = Math.max(1, current - 2);
    end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = end - 4;
  }

  const items = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) items.push("ellipsis-start");
  }
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push("ellipsis-end");
    items.push(totalPages);
  }
  return items;
}

export default function Pager({ page, totalPages, total, onChange }) {
  const [jump, setJump] = useState(String(page));

  // 页码变化时同步输入框显示
  useEffect(() => {
    setJump(String(page));
  }, [page]);

  const go = (target) => {
    if (target >= 1 && target <= totalPages && target !== page) onChange(target);
  };

  const handleJumpKeyDown = (event) => {
    if (event.key !== "Enter") return;
    const target = Number.parseInt(event.currentTarget.value, 10);
    if (Number.isInteger(target) && target >= 1 && target <= totalPages) {
      go(target);
    } else {
      setJump(String(page));
    }
  };

  return (
    <div data-fileName="Components/Pager.jsx" className="pager">
      <span>共 {total} 条</span>

      <button type="button" className="page-btn" disabled={page <= 1} onClick={() => go(page - 1)}>
        &lsaquo;
      </button>

      {buildPageItems(page, totalPages).map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            className={item === page ? "page-btn active" : "page-btn"}
            onClick={() => go(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="ellipsis">
            …
          </span>
        )
      )}

      <button
        type="button"
        className="page-btn"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        &rsaquo;
      </button>

      <span className="jump-label">前往第</span>
      <input
        className="jump-input"
        aria-label="跳转到指定页"
        value={jump}
        onChange={(event) => setJump(event.target.value)}
        onKeyDown={handleJumpKeyDown}
      />
      <span>页</span>
    </div>
  );
}
