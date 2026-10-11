# CPU 数据通路验证记录

验证日期：2026-10-11。

CPU Scene 已改为九模块的教学型单周期数据通路。PC、Instruction Memory、IR、Control Unit / Decoder 纵向排列，Register File、MUX、ALU、Data Memory 和 Write Back 完整显示。模型保留浅色视觉风格，没有新增页面。

- `npm run build` 成功：TypeScript、Vite 生产构建及 GitHub Pages 路径检查通过。
- `dist/` 生成 12 个文件；23 处生产资源引用通过检查，base 为 `/computer-architecture-visual-lab/`。
- `npm test`：11 项通过，覆盖写回时机、回退与重播、源/目标寄存器重叠、输入验证、32 位运算、执行路径与静态线路匹配、端口连接和避让模块。
- 九个外壳与标签正常渲染，十八条灰色线路、方向箭头、DATA / ADDRESS / CONTROL / MEMORY 图例完整显示；控制线路使用虚线，真正的数据分支带连接点。
- 独立浏览器生产预览验证：九个模块均可选择并显示 Inspector；Hover 高亮、Camera Focus 和其他模块淡化正常。未发生运行时错误或资源请求失败。
- Fetch、Register Read、Write Back 的路径和数据标签同步；ADD 经 ALU → Write Back → Register File，Data Memory 保持未启用。
- 单步执行 ADD 后 `R1 = 12`；上一步恢复 `R1 = 0`；重置回到初始状态。
- 实验页修改 `R2 = 9` 后，2× 自动播放得到 `R1 = 16`；非法 SUB 指令显示输入提示。
- 首页和实验室往返、教学标签切换、HashRouter 页面刷新正常。
- 1440px、1024px、768px、390px 宽度检查无横向溢出，手机上可选择组件。
- 首页保留 3 个已开放课程；其余 7 个课程明确标记为规划中。
- 五步动画明确为同一个时钟周期的观察步骤；IR 是教学展示点，Write Back 是结果选择器，并非额外时钟阶段。
- 静止时按需渲染，dpr 上限为 1.5，阴影贴图为 1024，无自定义复杂 shader。修正了薄底板遮挡灰线及空闲后单步动画提前结束的问题。

GitHub Pages 已启用，发布源为 GitHub Actions。推送到 main 后，部署工作流会安装依赖、运行现有测试、构建并发布 dist。

正式网址：https://agcenn.github.io/computer-architecture-visual-lab/

Three.js 引擎包的体积提示仍存在；生产构建成功，页面与场景分块加载。
