# Contributing

欢迎提交 Issue / PR。

## 开发环境

- macOS（构建脚本使用系统 `sips` 压缩图片；非 macOS 会跳过压缩）
- Node.js ≥ 20
- DeepSeek Harness 桌面端（仅安装/联调时需要）

```bash
node scripts/build.mjs        # 构建 lib/ 与 demo/manifest.js
node scripts/build.mjs --pack # 打包 dist/*.tgz
node scripts/test.mjs         # 离线验证（注入断言 + 本地服务 + 可选截图）
```

## 目录约定

| 路径 | 说明 |
|---|---|
| `src/taffy-boot.css` / `src/taffy-boot.js` | 动画源文件，改这里 |
| `lib/` | 构建产物（提交到仓库，方便直接安装） |
| `lib/index.js` | Host：路由与 `tapIndex` 注入 |
| `lib/client.js` | 客户端 bundle 兜底 |
| `backgrounds/` | 用户素材，**不要提交图片** |
| `docs/images/` | 文档截图，必须使用占位角色（无第三方版权素材） |

## PR 检查清单

- [ ] `node scripts/test.mjs` 通过
- [ ] `node scripts/build.mjs --pack` 成功，`lib/` 已更新
- [ ] 没有提交任何第三方图片（`backgrounds/`、`lib/assets/` 应为空，仅保留 `.gitkeep`）
- [ ] 涉及行为变化时更新 `README.md` / `README.en.md` 与 `CHANGELOG.md`

## 提交信息

建议使用 [Conventional Commits](https://www.conventionalcommits.org/)：
`feat:`、`fix:`、`docs:`、`chore:`。
