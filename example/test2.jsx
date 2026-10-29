// test2.jsx —— 被另一个 JSX 文件 import 的子组件，用于测试链式 JSX 加载
import React from 'react';

const Test2 = () => (
  <div className="test2-box" data-fileName="test2.jsx">
    <p>这个组件来sss自 test2.jsx（由 app.jsx 动态 import 并经 Babel 编译）</p>
  </div>
);

export default Test2;
