# Changelog

## Unreleased

- 安装器除了关闭旧片头配置，还会把 `dsh-startup-secret` 从 bundles 移除，
  避免与长征机片头在启动时叠加

- 仓库附带 19 张演示图片（真实塔菲效果），新增 `NOTICE.md` 说明版权与移除通道
- 文档截图改用真实效果，保留占位角色截图作为“无图兜底”示例

## 1.0.7

- 增加 4 张自动合成拼贴（多脸合集 / 三联竖幅 / 拍立得贴墙 / 模糊背景人像）
- 换图节奏从 3 s 调整为 1.8 s，一轮可见 5–6 张
- 修复拼贴生成时把上一轮成品当素材的问题

## 1.0.4

- 新增客户端 bundle 兜底通道（`lib/client.js`），覆盖 `dsh-app://` 直出文档
- 新增 `/dsh-taffy/beacon` 诊断端点

## 1.0.2

- 修复 macOS AppleDouble（`._*`）元数据被打进插件包、被当作图片的问题

## 1.0.0

- 首个原生插件版本：Host 通过 `webServer.tapIndex` 注入首屏动画
- 支持 `~/.dsh/taffy-boot.json` 配置（enabled / duration / playOnce / allowSkip）
- 安装脚本自动关闭旧片头并备份配置
