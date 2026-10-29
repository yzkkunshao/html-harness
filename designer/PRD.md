
制作一个Agent驱动的原型页面设计器。

技术栈：
React 19、TailwindCSS、HTML、css、jsx、js。


关键机制（实测验证）：
- 加载顺序固定：esm-x（阻塞式，必须在最前）→ importmap → es-module-shims（async）
- 页面入口：HTML 中用内联 `<script type="esm-x">import './App.jsx';</script>` 作为唯一入口
- 链式编译：esm-x 劫持 esmsInitOptions.fetch，对同源 fetch 到的所有模块（含 .jsx）自动 Babel 编译，因此 jsx 文件之间可以任意相互 import
- react / react-dom 通过 importmap 映射到 vendor/ 下的本地 ESM 构建版本

概念讲解：
工作目录：pi的DefaultResourceLoader的cwd，用户可自行切换工作目录，工作目录切换后有已有配置（如.pi）则直接复用，没有则创建，本agent需要支持所有pi-agent支持的配置
素材目录：工作目录下的Components目录。用户切换时如果目录不存在则创建，存放所有素材
素材：以jsx文件形式存在的react组件。
素材Rule:
1. 不使用脚手架、不使用构建工具，运行时由 esm-x 在浏览器内编译
2. jsx 中的素材均带有语义化 className
3. 所有 jsx 通过 ES Module 相对路径 import 引入；禁止 `<script type="esm-x" src="...">` 外链写法——esm-x 只读取内联脚本内容（innerHTML），src 写法会导致静默空白（实测踩坑）
4. 素材根节点有data-fileName属性，用于后续Add To Context功能供Agent驱动

交付物最终运行时环境：不使用脚手架、不使用构建工具，运行时由 esm-x 在浏览器内编译参考html-harness\example\index.html

沙盒运行时环境二：在现代浏览器环境由Bun能够通过import(url)的形式import 素材

素材需要在两种运行时环境同时运行成功，且效果一致

页面：HTML页面由素材和依赖、全局样式组成，每个页面只包含一个根素材，其他素材由根素材挂载。除了素材和公共依赖以外还包含全局样式，工作目录下允许多个页面，允许页面间共享相同素材。这是Agent最终的交付物,页面*.html内容通常是不变的，但依赖和引入的依赖会改变。

对话：Agent驱动的对话
Agent驱动：基于earendil-works/pi Pi-agent的sdk驱动,用户通过对话驱动agent完成原型的设计

举例（完整可复制，来源 pi/html-harness/example）：

目录结构：
```
工作空间(PI_WEB_ROOT指定)
交付物页面/
├── index.html          # 页面（Agent 交付物）
├── style.css           # 全局样式（可选）交付物最终运行时环境和沙盒运行时环境的汇合点
├── App.jsx             # 页面入口：负责挂载 + 组合素材 交付物最终运行时环境和沙盒运行时环境的汇合点
├── Components/         # 素材目录，存放所有素材 jsx
│   ├── Header.jsx
│   └── Button.jsx
├── server.js           # 零依赖静态服务器（node server.js 启动）
└── vendor/             # 公共依赖（模板提供，勿手写、勿改动）
    ├── esm-x.js
    ├── es-module-shims.js
    ├── react.js
    ├── react-dom.js
    ├── react-dom-client.js
    ├── scheduler.js
    └── scripts/
        ├── babel.js
        └── compiler.js
```

index.html：
页面运行方式：无构建步骤、无 node_modules、无脚手架——jsx 由 esm-x 在浏览器内调用 Babel 运行时编译，本地服务提供纯静态文件代理（参考 example/server.js，零依赖 node http，端口 5600）。

模板：
最初的页面，包含：vendor/ 全套依赖、server.js、index.html（内联 esm-x 入口指向 App.jsx）、空的 App.jsx、空的 style.css、空的 Components/ 目录

功能：
0. 工作目录切换：用户可以打开本地的工作目录，也可以切换工作目录。pi\html-harness\skeleton 已经实现
1. 页面设计器：加载工作目录下的任意页面的App.jsx。页面设计器支持三种模式：预览模式、编辑模式、组件树模式、预览模式：直接window.Open看页面。编辑模式：直接文本输入框展示jsx代码，组件树模式（展示依赖的子组件树）预览模式支持组件选中开关，打开组件选中开关以后鼠标右键菜单切换到其他模式，切换后组件树对应组件高亮
2. 素材跳转功能：组件树模式下，用户能在页面渲染界面中可以跳转到指定素材界面，右键菜单。
3. Add To Context功能，任意组件支持Add To Context功能，往提示词中注入组件对应文件路径


技术栈：react、Bun、pi-monorepo的任意子包，比如@earendil-works/pi-coding-agent

