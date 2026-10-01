# 第三方组件声明

本项目自身代码以 MIT 许可证发布（见 `LICENSE`）。`assets/` 目录下包含若干第三方
开源资源，它们各自遵循原有许可证，**不适用**本项目的 MIT 条款：

| 组件 | 版本 | 许可证 | 说明 |
|------|------|--------|------|
| [Bootstrap](https://getbootstrap.com/) | 4.3.1 | MIT | `assets/css/bootstrap.min-4.3.1.css` |
| [Font Awesome Free](https://fontawesome.com/) | 5.15.4 | 字体：SIL OFL 1.1<br>图标/CSS：CC BY 4.0<br>代码：MIT | `assets/fontawesome-5.15.4/` |
| [jQuery](https://jquery.com/) | 3.2.1 | MIT | `assets/js/jquery.min-3.2.1.js` |

## 关于 OneNav 主题样式

本仓库的早期版本曾包含两份源自商业 WordPress 主题 **OneNav（一为导航，
<https://www.iotheme.cn/>，作者 iowen）** 的样式文件：

- `assets/css/style-3.03029.1.css`
- `assets/css/iconfont-3.03029.1.css` 及配套图标字体

该主题为**付费商业授权**，其授权条款不允许自由转售与再分发源码。经核查，
本项目页面中的自定义样式类（`about-*`、`feature-*`、`submit-*`、`highlight-box`
等）均定义在页面自身的 `<style>` 内联块中，`form-control` / `form-group` 来自
Bootstrap，**并未实际使用 OneNav 的任何样式规则**。

因此上述两份文件已从仓库中**完整移除**，同时移除了 `about/index.html` 与
`commit.html` 中对它们的两处 `<link>` 引用。当前仓库不再包含任何商业主题资源。
