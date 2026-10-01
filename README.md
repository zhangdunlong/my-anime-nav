# 🌸 实用导航 · Anime Nav

一个动漫风格的网址导航站，纯前端 + Cloudflare Pages Functions 构建，无需数据库。
包含可登录的后台管理、Cloudflare KV 云端同步，以及附带的 **IP 工具箱** 与 **网站测速** 两个小工具。

> 项目由 AI 辅助设计并迭代，代码在持续维护中。

---

## ✨ 功能

### 导航首页（`/`）
- 动漫主题：紫粉渐变、毛玻璃卡片、粒子/雪花背景、流畅动画
- 分类侧边栏 + 卡片网格，桌面 / 平板 / 手机自适应
- 搜索：本地站点即时过滤，也可在 Google / 百度 / 必应等引擎间切换
- 日间 / 夜间模式一键切换
- 右下角 IP 浮窗：多源查询本机出口 IP 与延迟

### 后台管理（首页内联，非弹窗）
- 密码登录（**服务端校验**，密码不落前端）
- 站点增 / 删 / 改，支持拖拽排序；分类同样可增删改与排序
- 添加站点时自动抓取目标网页的标题与描述
- 导入 / 导出 JSON、恢复默认数据、修改管理密码
- **云端同步**：一键推送到 Cloudflare KV，或从 KV 拉回本地

### IP 工具箱（`/ip`）
六个标签页：概览 / 详情 / 网络 / 延迟 / 浏览器 / AI 服务。

- IP 归属地、ASN、风险评级（住宅 / 机房 / 代理判定）
- DNS over HTTPS 多解析器对比，检测 DNS 污染
- CDN 识别、RDAP / WHOIS 查询、Globalping 全球节点 Ping
- 浏览器指纹（Canvas / WebGL / Audio / 字体）、环境一致性自检、WebRTC 泄漏检测
- AI 服务可达性与官方状态页聚合

### 网站测速（`/speed`）
- 延迟测试（多站点）、下载 / 上传带宽测试、全球节点延迟
- 下载走同源静态资源 + 国内 CDN 双源并行；上传走同源 Function
- 结果展示过程中的**峰值带宽**而非平均值

### 其它页面
| 路径 | 说明 |
|------|------|
| `/about` | 关于页，樱花飘落动画 |
| `/commit.html` | 申请收录表单（数据存 localStorage，供站长线下处理） |
| `/404.html` | 404 页面 |

---

## 🚀 部署到 Cloudflare Pages

### 1. 准备仓库

```bash
git clone https://github.com/zhangdunlong/my-anime-nav.git
cd my-anime-nav
```

### 2. 创建 KV 命名空间

站点数据、搜索引擎、后台密码与会话都存放在 KV 中：

```bash
npx wrangler kv namespace create NAV_DATA
```

把输出里的 `id` 填进 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "NAV_DATA"
id = "你的命名空间 ID"
```

### 3. 设置后台管理密码

后台不保存明文密码，KV 中存的是 `sha256(密码 + salt)`。用脚本生成：

```bash
node scripts/set-admin-password.mjs 你的新密码
```

脚本会打印两条 `wrangler kv key put` 命令，把其中的命名空间 ID 替换后执行即可。

### 4. 生成测速用的静态资源

下载测速依赖一个较大的随机文件，它体积太大不适合入库，需本地生成：

```bash
node scripts/gen-speed-asset.mjs      # 默认 10 MB
```

### 5. 部署

```bash
npx wrangler pages deploy . --project-name=my-anime-nav
```

在 Cloudflare Pages 控制台的 **Settings → Functions → KV namespace bindings**
里确认已绑定 `NAV_DATA`（通过 Dashboard 创建项目时需要手动加这一步）。

### 6. 自定义放行来源（可选）

后端默认**放行同源请求**，所以部署到任何域名都能直接用。
如果还需要允许别的来源（本地开发端口、自定义子域等），在
**Settings → Environment variables** 添加：

```
ALLOWED_ORIGINS = http://localhost:5173,https://your-domain.com
```

---

## 🛠 本地开发

```bash
npx wrangler pages dev . --port 8788
```

访问 <http://localhost:8788>。该命令会同时加载 `functions/` 下的 Pages Functions
与本地 KV 模拟，功能与线上一致。

直接双击 `index.html` 用 `file://` 打开也能看首页，但云端同步、IP 工具箱、
测速等依赖 Functions 的功能不可用。

---

## 📁 目录结构

```
my-anime-nav/
├── index.html                 # 首页（含内联样式与后台管理 DOM）
├── app.js                     # 站点数据 + 渲染引擎 + 搜索 + 后台管理逻辑
├── 404.html / _headers        # 404 页与安全响应头（CSP 等）
├── about/                     # 关于页
├── admin/                     # 旧管理入口（已跳转到首页）
├── commit.html / commit.js    # 申请收录表单
├── ip.html                    # IP 工具箱页面
├── ip-app.js                  #   ├ 主逻辑：查询、DNS、CDN、延迟、地图
├── ip-browser.js              #   ├ 浏览器指纹与环境自检
├── ip-ai.js                   #   └ AI 服务可达性与状态页
├── speed.html / speed-app.js  # 网站测速页面与逻辑
├── functions/
│   ├── api/data.js            # 站点数据读写 + token 鉴权（登录 / 改密 / 登出）
│   ├── api/ip.js              # 回显客户端 IP 与 CF 地理信息
│   ├── api/fetch-meta.js      # 抓取网页标题 / 描述（SSRF 防护 + 限流）
│   ├── api/netprobe.js        # 网络诊断代理（严格域名白名单，非开放代理）
│   ├── speedtest-up.js        # 上传测速端点
│   └── speedtest-down.js      # 下载测速端点
├── assets/
│   ├── css/custom-style.css   # 动漫主题自定义样式
│   ├── css/bootstrap.min-4.3.1.css
│   ├── fontawesome-5.15.4/    # 图标库
│   ├── js/jquery.min-3.2.1.js
│   └── images/favicon.svg
├── scripts/
│   ├── gen-speed-asset.mjs    # 生成测速大文件
│   └── set-admin-password.mjs # 生成后台密码的 salt 与哈希
├── wrangler.toml
├── LICENSE                    # MIT
└── NOTICE.md                  # 第三方组件声明
```

---

## 📝 自定义

### 换掉默认站点数据

编辑 `app.js` 顶部的 `SITES_DATA`：

```javascript
var SITES_DATA = {
  "分类名": [
    { name: '站点名', url: 'https://example.com', desc: '描述' },
  ],
};
```

仓库里自带的是一份**示例数据**，请在部署前替换成你自己的收藏。
部署后也可以直接在网页上用后台管理增删改，并推送到 KV。

### 站点图标（favicon）

默认直接取目标站点自身的 `/favicon.ico`，不依赖任何第三方服务：

```javascript
var FAVICON_PROXY = '';
```

如果你自建了 favicon 反向代理，按模板填入即可：

```javascript
var FAVICON_PROXY = 'https://favicon.example.com/s2/favicons?domain={domain}&sz={size}';
```

### 修改主题配色

编辑 `assets/css/custom-style.css`，以及 `index.html` 顶部的内联 `<style>`，
搜索 `#a855c7`、`#ec4899`、`#2d1b69` 等主色值替换即可。

---

## 🔒 安全设计

- 后台密码经 `SHA-256 + 随机 salt` 哈希后存入 KV，前端不保存密码
- 会话 token 存于 KV，24 小时过期；校验使用常量时间比较，防时序攻击
- 所有写接口校验 `Origin` / `Referer`（CSRF 防护）
- 按 IP + 时间窗口限流，登录接口阈值更严
- 请求体大小限制、数据结构校验、错误信息脱敏
- `fetch-meta.js` 与 `netprobe.js` 均有 SSRF 防护；后者为严格白名单代理，不构成开放代理
- `_headers` 中配置了 CSP、HSTS、`X-Frame-Options` 等安全响应头

---

## 📄 许可证

本项目代码以 **MIT** 许可证发布，详见 [LICENSE](LICENSE)。

`assets/` 下的 Bootstrap、Font Awesome、jQuery 遵循各自原有许可证，
详见 [NOTICE.md](NOTICE.md)。
