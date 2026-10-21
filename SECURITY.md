# Security

## 这个插件做什么

`dsh-taffy-boot` 是 DeepSeek Harness 的本地 Cordis 插件，只做两件事：

1. 在 GUI 的 `index.html` 里注入一段启动动画的样式与脚本；
2. 通过本地路由（`/dsh-taffy/*`）提供动画所需的 CSS、JS、图片与配置。

## 不做什么

- 不修改 `app.asar`、不替换应用内任何文件、不改代码签名
- 不读写 API Key、登录态、会话内容或任务数据
- 不监听额外端口、不向外部网络发起请求
- 不使用 `--remote-debugging-port`，没有 CDP 暴露面

## 本地威胁模型

- 插件运行在 DSH 进程内，注入的代码与 GUI 同源；能访问页面 DOM，但仅限本地渲染进程。
- `~/.dsh/taffy-boot.json` 与 `backgrounds/` 中的图片由本机用户控制；
  能修改它们的人本就能修改你的用户目录，属于同等信任级别。
- 安装/卸载会改写 `~/.dsh/profiles/desktop/package.json` 与 `~/.dsh/dsh-startup.json`
  （后者会先备份为 `.taffy-bak`）。

## 报告问题

如发现注入逻辑、路由（路径穿越、任意文件读取）或配置处理方面的安全问题，
请通过 Issue 私密报告，或在 Issue 中避免公开可利用细节。
