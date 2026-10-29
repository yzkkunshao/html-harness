// server.js —— 零依赖 Node 静态文件服务
// 用法：node server.js
// 访问：http://localhost:5600/index.html → ./index.html

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5600;
// 静态根目录：本文件所在目录（即 example 目录）
const ROOT = __dirname;

// 常见 MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // 去掉查询参数，解码 URL
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // 根路径默认返回 index.html
  if (urlPath === '/') urlPath = '/index.html';

  // 拼接绝对路径，并防止目录穿越攻击（../ 逃出根目录）
  // 用 resolve 规范化后校验前缀，避免 Windows 路径分隔符/相似目录名带来的误判
  // 前置 '.' 防止 Windows 下 "//x" 这类以斜杠开头的路径被解析为盘符根目录
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`404 Not Found: ${urlPath}`);
    }

    // 根据扩展名设置 Content-Type，默认按纯文本处理
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`静态服务已启动: http://localhost:${PORT}/index.html`);
  console.log(`根目录: ${ROOT}`);
});
