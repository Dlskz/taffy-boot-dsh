# NOTICE

## 代码

本仓库的代码（`lib/`、`src/`、`scripts/`、`demo/` 等）以 **MIT License** 发布，见 [LICENSE](LICENSE)。

## 演示图片

`backgrounds/`、`lib/assets/`、`docs/images/` 中的图片是**永雏塔菲（Taffy）相关的二创素材**，
由本仓库作者提供，仅用于演示本项目的启动动画效果。

- 塔菲形象及相关作品的著作权归**永雏塔菲官方及其原作者**所有
- 这些图片**不在 MIT 授权范围内**，不构成对任何角色的再授权
- 本项目与 DeepSeek、永雏塔菲官方均无隶属关系
- 如果你是权利人并希望移除这些图片，请提交 Issue 或联系作者，
  我会在确认后**立即删除图片**，代码与功能不受影响

维护者移除方式：

```bash
git rm backgrounds/*.JPG backgrounds/*.jpg \
       lib/assets/*.jpg \
       docs/images/preview-taffy.png docs/images/collage-preview.png
node scripts/build.mjs --pack
git commit -m "chore: remove demo artwork"
```

## 第三方代码参考

- [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)（MIT）
- [fishcold789/Taffy-Codex-Theme-Studio](https://github.com/fishcold789/Taffy-Codex-Theme-Studio)
- [NativeDog1/dsh-boot-animation](https://github.com/NativeDog1/dsh-boot-animation)（BSD-3-Clause）

本项目只参考了它们的实现思路与工程结构，未复制其代码。
