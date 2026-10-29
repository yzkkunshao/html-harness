// detail.mount.jsx —— 模板生成的挂载文件（非素材），交付运行时入口
import React from "react";
import { createRoot } from "react-dom/client";
import DetailPage from "./detail.jsx";

createRoot(document.getElementById("root")).render(React.createElement(DetailPage));
