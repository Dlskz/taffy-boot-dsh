# AGENTS.md

本文件写给在本仓库工作的 AI 代理或贡献者。

## 目标

维护一个 **DSH 原生 Cordis 插件**：让原版 DeepSeek Harness 图标启动时，
在 GUI 首帧播放塔菲启动动画。

## 硬性边界

1. 演示图片**允许**随仓库提交（用户明确要求展示真实塔菲），但必须在 `NOTICE.md`
   记录来源与授权状态，并保留移除通道；新增图片时同步更新 NOTICE。
2. **禁止**修改 `/Applications/DeepSeek Harness.app` 内任何文件或签名。
3. **禁止**读写用户 `~/.dsh` 下的凭据、会话、任务数据。
4. 不需要 `--remote-debugging-port`；不要为本插件引入调试端口。
5. 安装/卸载会改写用户 profile 与 `dsh-startup.json`，必须保留 `.taffy-bak` 备份。

## 工作流

```bash
node scripts/build.mjs --pack   # src → lib，压缩素材，打包
node scripts/test.mjs           # 离线验证（注入断言 + 本地服务 + 截图）
node scripts/install.mjs        # 安装到 desktop profile（用户确认后）
node scripts/install.mjs --uninstall
```

## 约定

- 视觉改 `src/taffy-boot.css`（`--tb-*` 变量）
- 台词/节奏改 `src/taffy-boot.js` 的 `DEFAULTS` 与 `swapMs`
- 注入逻辑改 `lib/index.js`；客户端兜底改 `lib/client.js`
- 改完必须重新 `build.mjs --pack`，并同步 `CHANGELOG.md`
- 提交信息使用 Conventional Commits

## 验证清单

- [ ] `node scripts/test.mjs` 通过
- [ ] `lib/splash.css`、`lib/splash.js` 与 `src/` 一致（build 生成）
- [ ] `git status` 中没有 `dist/`、`*.tgz`
- [ ] 新增/替换图片后已同步 `NOTICE.md`，并重跑 `build.mjs --pack`
- [ ] `demo/manifest.js` 与 `lib/assets/` 的图片数量一致
