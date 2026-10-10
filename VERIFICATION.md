# 第一阶段验证记录

验证日期：2026-10-10。

页面采用浅色背景、清晰的大标题、蓝色圆角按钮，以及银色底板与石墨灰模块的 3D 场景。首页、实验室与模型控件使用统一的视觉语言。

- `npm run build` 成功：TypeScript、Vite 生产构建及 GitHub Pages 路径检查通过。
- `dist/` 生成 12 个文件；23 处生产资源引用通过检查，base 为 `/computer-architecture-visual-lab/`。
- `npm test`：7 项通过，覆盖写回时机、回退与重播、源/目标寄存器重叠、输入验证和 32 位运算。
- 独立浏览器生产预览验证：3D 正常渲染，ALU 选择和 Inspector 正常；未发生运行时错误或资源请求失败。
- 单步执行 ADD 后 `R1 = 12`；上一步恢复 `R1 = 0`；重置回到初始状态。
- 实验页修改 `R2 = 9` 后，2× 自动播放得到 `R1 = 16`；非法 SUB 指令显示输入提示。
- 首页和实验室往返、教学标签切换、HashRouter 页面刷新正常。
- 1366px、1024px、768px、390px 宽度检查无横向溢出。
- 首页保留 3 个已开放课程；其余 7 个课程明确标记为规划中。

GitHub Pages 已启用，发布源为 GitHub Actions。推送到 main 后，部署工作流会安装依赖、运行现有测试、构建并发布 dist。

正式网址：https://agcenn.github.io/computer-architecture-visual-lab/

Three.js 引擎包的体积提示仍存在；生产构建成功，页面与场景分块加载。
