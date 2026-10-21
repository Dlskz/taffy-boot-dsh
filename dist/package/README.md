# 永雏塔菲 × DeepSeek Harness 启动动画

[English](README.en.md) | **中文**

给 DeepSeek Harness 桌面端加一段**塔菲主题的启动动画**：点原版图标打开，就在 GUI 首帧播放。

> 粉色星空、台词打字机、糖果进度条、点击彩蛋，约 9 秒，`Esc` / 「跳过」可随时跳过。

![启动动画预览](docs/images/preview-mascot.png)

原生 **Cordis 插件**实现：通过 `webServer.tapIndex` 把动画注入首屏 `index.html`，
并用客户端 bundle 兜底渲染。**不修改 `app.asar`、不改代码签名、不需要调试端口。**

> 非官方二创项目，与 DeepSeek、永雏塔菲官方均无隶属关系。

---

## 特性

- **原版启动即生效**：不需要包装 App、快捷方式或命令
- **双通道渲染**：Host 注入 + 客户端 bundle 兜底（`dsh-app://` 直出也能播）
- **多图轮播**：把图片放进 `backgrounds/`，每 1.8 秒交叉淡入，每次启动随机打散
- **可选拼贴**：`make-collages.py` 自动合成多脸合集 / 三联竖幅 / 拍立得 / 模糊背景人像
- **无图可用**：没放素材时展示原创占位角色（纯 SVG）
- **彩蛋**：点立绘冒爱心与随机台词；久置会出现「塔菲在等你哦～」；连点有「呜喵！」
- **安全兜底**：最长 16 秒必定消失；等 GUI 挂载后才揭幕；后台窗口不播
- **可完全还原**：卸载插件 + 恢复旧片头配置，与安装前一致

---

## 安装

### 前置

- macOS + [DeepSeek Harness 桌面端](https://www.deepseek.com/)（`0.2.x`）
- Node.js ≥ 20（或使用 DSH 自带运行时）

### 一键安装

```bash
git clone <your-repo-url> taffy-boot-dsh
cd taffy-boot-dsh

# 可选：把你的塔菲图片放进 backgrounds/
node scripts/build.mjs --pack     # 构建并打包
node scripts/install.mjs          # 安装到 desktop profile
```

然后**完全退出 DSH（⌘Q）再打开**，即可看到启动动画。

安装脚本会：

- 执行 `dsh plugin --profile desktop add file:dist/dsh-taffy-boot-<version>.tgz`
- 把 `dsh-taffy-boot` 写入 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles`
- 关闭 `dsh-startup-secret` 的旧片头（备份为 `~/.dsh/dsh-startup.json.taffy-bak`）

### 卸载

```bash
node scripts/install.mjs --uninstall
```

---

## 素材

仓库**不包含任何塔菲图片**（版权原因）。所有图片由使用者本地提供：

```text
backgrounds/            # ← 放你的图（已被 .gitignore 排除）
```

1. 图片放进 `backgrounds/`（建议 4:5 竖图、主体居中偏上）
2. 可选：`python3 scripts/make-collages.py` 合成 4 张拼贴图
3. `node scripts/build.mjs --pack && node scripts/install.mjs`
4. 完全退出并重开 DSH

> 大图会自动用 macOS `sips` 压缩到长边 1100。

---

## 自定义

**台词 / 节奏 / 时长**：编辑 `src/taffy-boot.js` 顶部 `DEFAULTS`：

```js
var DEFAULTS = {
  duration: 9000,                          // 主时间轴
  lines: [ '关注永雏塔菲谢谢喵～', ... ],    // 轮播台词
  easterLines: [ '戳戳塔菲…呜喵～', ... ],   // 点击彩蛋
  steps: [ [900, '检查运行环境…'], ... ]     // [毫秒, 进度文案]
};
```

**配色**：`src/taffy-boot.css` 顶部 `--tb-*` 变量。
**换图间隔**：`src/taffy-boot.js` 里的 `swapMs`（默认 1800）。

改完重新 `build.mjs --pack` + `install.mjs`，重开 DSH 生效。
预览页 `demo/boot-preview.html` 可先看效果（含重播/跳过按钮）。

---

## 配置

`~/.dsh/taffy-boot.json`：

```json
{
  "enabled": true,
  "tap": true,
  "client": true,
  "duration": 9000,
  "playOnce": true,
  "allowSkip": true
}
```

| 字段 | 说明 |
|---|---|
| `enabled` | 总开关，`false` 临时关闭（重开窗口生效） |
| `tap` | Host 注入通道，`false` 关闭 |
| `client` | 客户端 bundle 兜底通道，`false` 关闭 |
| `duration` | 主时间轴毫秒数 |
| `playOnce` | 每个窗口只播一次 |
| `allowSkip` | 是否允许跳过 |

---

## 工作原理

```text
DSH 启动 → 桌面宿主装配 profile bundles
        → 加载 dsh-taffy-boot（Host）
        ├─ webServer.register(/dsh-taffy/splash.css、splash.js、asset、config、beacon)
        ├─ webServer.tapIndex(html => 注入 <link> + 首屏遮罩 + 图片清单 + <script defer>)
        └─ 客户端 bundle（lib/client.js）
             若页面未被注入（如 dsh-app:// 直出），fetch /dsh-taffy/config
             → 载入 splash.js → 渲染同一条动画（__TAFFY_BOOT_LOADED__ 防重复）
               → 9s 后等 GUI 挂载完成 → 淡出并移除遮罩
```

排查记录在 `~/.dsh/taffy-boot.log`（`plugin ready` / `inject ok` / `beacon: client`）。

---

## 开发

```bash
node scripts/build.mjs        # 同步 src → lib，压缩素材，生成 demo/manifest.js
node scripts/build.mjs --pack # 额外打包 dist/*.tgz
node scripts/test.mjs         # 离线验证：注入断言 + 本地服务 + 无头截图
```

目录：

```text
lib/                 构建产物（splash.css/js、index.js、client.js）
src/                 动画源（taffy-boot.css / taffy-boot.js）
scripts/              build / install / test / shoot / make-collages
demo/                独立预览页
backgrounds/         用户素材（不入库）
docs/images/         文档截图（占位角色，无版权风险）
```

---

## 常见问题

| 现象 | 处理 |
|---|---|
| 重开 DSH 没动画 | `tail ~/.dsh/taffy-boot.log`；确认 `~/.dsh/taffy-boot.json` 里 `enabled` 不为 false；确认完全退出（⌘Q） |
| 只有 `plugin ready` 没有 `inject ok` | 该窗口走了 `dsh-app://` 直出；确认 `client: true`，日志里应有 `beacon: client` |
| 日志出现「没有可用的 webServer」 | 当前 profile 为 file:// + IPC 形态，插件无法注入 |
| 刷新窗口没重播 | 正常：首屏注入只发生在窗口创建时 |
| 图片不显示 | 重跑 `build.mjs --pack` 与 `install.mjs`；确认 `lib/assets/` 里有图 |
| 想临时关掉 | `~/.dsh/taffy-boot.json` 设 `"enabled": false` |

---

## 安全

- 不修改 `app.asar`、不替换应用文件、不改签名
- 不读写 API Key、登录态与任务数据
- 不使用调试端口；动画只在本地 GUI 内渲染
- 详见 [SECURITY.md](SECURITY.md)

---

## 免责声明

- 非官方项目，与 DeepSeek、永雏塔菲官方无隶属关系
- 塔菲形象及相关作品的著作权归原作者/官方所有
- 仓库不附带任何第三方图片；示例截图使用原创占位角色
- 使用者自行提供的素材仅限本地个人使用，请遵守相应授权

---

## 致谢

- [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) —— 不改官方文件的注入边界与主题工程
- [fishcold789/Taffy-Codex-Theme-Studio](https://github.com/fishcold789/Taffy-Codex-Theme-Studio) —— 塔菲视觉与插件组织
- [NativeDog1/dsh-boot-animation](https://github.com/NativeDog1/dsh-boot-animation) —— DSH 片头插件的客户端 bundle 形态参考
- 永雏塔菲相关梗与台词来自公开社区文化

MIT License · 代码部分
