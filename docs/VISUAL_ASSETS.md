# 配图与提示词

三张概念插画使用内置 `image_gen` 工具生成（2026-10-13）。用于首页封面及展开后的模型说明；它们是装饰性概念图，具体的数据通路、标签与模拟状态由代码绘制。

项目内导出为 1600 × 900 WebP，质量 82，保留原图内容，仅缩放并压缩。原始 PNG 保留在生成工具的默认目录，网站不依赖本机路径。

## architecture-cover.webp

保存位置：[src/assets/visuals/architecture-cover.webp](../src/assets/visuals/architecture-cover.webp)。

完整生成提示词：

```text
Use case: stylized-concept. Asset type: decorative editorial image for a Chinese computer architecture learning website with a minimal Apple-inspired light design. Landscape 16:9 composition. Premium, restrained 3D product still life on a seamless warm white studio background, matte white and brushed silver materials, soft shadows, clean precise rounded forms and generous negative space. No text, no letters, no numbers, no brand or logo, no watermark, no people, no screens, no decorative UI. This is conceptual decorative art, not an instructional schematic or an actual CPU microarchitecture. Subject: an unbranded silver processor seated on a refined white and silver circuit board, fine precise circuit traces, a few soft blue glass details, viewed at an elegant three-quarter angle. The processor and surrounding traces are the single focal object, tactile and beautifully lit. Restrained blue accents, realistic metal finish, no neon or cyberpunk style. Keep the whole subject within the central 70 percent of the canvas.
```

## cache-cover.webp

保存位置：[src/assets/visuals/cache-cover.webp](../src/assets/visuals/cache-cover.webp)。

完整生成提示词：

```text
Use case: stylized-concept. Asset type: decorative editorial image for a Chinese computer architecture learning website with a minimal Apple-inspired light design. Landscape 16:9 composition. Premium, restrained 3D product still life on a seamless warm white studio background, matte white and brushed silver materials, soft shadows, clean precise rounded forms and generous negative space. No text, no letters, no numbers, no brand or logo, no watermark, no people, no screens, no decorative UI. This is conceptual decorative art, not an instructional schematic or an actual CPU microarchitecture. Subject: a small unbranded silver processor beside exactly FOUR distinct stacked translucent pale-blue glass memory tiles, with one larger matte white memory module set back behind them. Conceptual storage hierarchy. The four tiles are all visibly distinguishable; subtle green highlight on one tile. Silver, pale blue and a small muted green accent. No arrows, labels, wires linking stages, glow effects or diagram claims. Keep all objects centered with breathing room.
```

## pipeline-cover.webp

保存位置：[src/assets/visuals/pipeline-cover.webp](../src/assets/visuals/pipeline-cover.webp)。

完整生成提示词：

```text
Use case: stylized-concept. Asset type: decorative editorial image for a Chinese computer architecture learning website with a minimal Apple-inspired light design. Landscape 16:9 composition. Premium, restrained 3D product still life on a seamless warm white studio background, matte white and brushed silver materials, soft shadows, clean precise rounded forms and generous negative space. No text, no letters, no numbers, no brand or logo, no watermark, no people, no screens, no decorative UI. This is conceptual decorative art, not an instructional schematic or an actual CPU microarchitecture. Subject: exactly FIVE separate white and silver rounded processing modules arranged in a gentle diagonal rhythm, each carrying a small translucent colored inset. In order: blue, violet, warm amber, green and teal. Conceptual parallel processing stages, not a scientific diagram. Precisely five modules visible, all equally important, playful restrained product photography, soft studio light. No arrows, links, symbols, neon glow or text. Keep all five objects within the central 75 percent.
```

## 网站预览

`docs/screenshots/home.webp` 是本项目生产预览的实际截图。所有配图随源码提交，运行时由 Vite 生成带仓库 base path 的资源 URL。

