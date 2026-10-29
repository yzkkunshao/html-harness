// app.jsx —— 从 HTML 内联脚本抽出的独立 JSX 入口
import React from 'react';
import { createRoot } from 'react-dom/client';
// 链式引入：esm-x 的 fetch 钩子会对这里拉取的 test2.jsx 自动做 Babel 编译
import Test2 from './test2.jsx';

const App = () => (
  <>
    <div data-fileName="app.jsx">
      <h1>Hello JSX + Importmap</h1>
      <Test2 />
    </div>

  </>
);

createRoot(document.getElementById('root')).render(<App />);
