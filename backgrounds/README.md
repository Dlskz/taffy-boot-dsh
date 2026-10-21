# 把你的塔菲图片放这里

把 `.jpg / .png / .webp` 图片放进本目录，然后运行：

```bash
node scripts/build.mjs --pack
node scripts/install.mjs
```

再完全退出并重开 DSH，动画就会轮播你的图片。

- 建议 4:5 竖图或方图、主体居中偏上；单张 ≤ 700KB 体验最好
- 超过 350KB 或宽于 800px 的图会自动用 macOS `sips` 压缩一份
- 可选：`python3 scripts/make-collages.py` 会用这些图自动合成 4 张拼贴图
- 本目录的图片已被 `.gitignore` 排除，不会进入仓库
