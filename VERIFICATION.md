# Instruction Simulator 验证记录

验证日期：2026-10-11。

现有 Instruction Execution Visualizer 支持 ADD、SUB、LOAD、STORE、MOV；没有新增页面。保留浅色界面和九模块教学型 CPU 数据通路，所有模拟运算在浏览器中完成。

- `npm run build` 成功：TypeScript、Vite 生产构建及 GitHub Pages 路径检查通过。`dist/` 生成 13 个文件，23 处生产资源引用通过检查，base 为 `/computer-architecture-visual-lab/`。
- `npm test`：24 项通过。覆盖五种指令、逐步完整状态恢复、源与目标重叠、STORE 内存撤销、连续执行、解析和编辑验证、稀疏内存、高地址、32 位溢出与控制信号。
- 六个观察步骤为 FETCH、DECODE、REGISTER READ、EXECUTE、MEMORY、WRITE BACK。CPUState、ExecutionStep、执行前快照与历史记录共同驱动 Inspector、模块高亮、线路数值和动画；3D 场景不自行修改 CPU 状态。
- 默认 ADD 在 EXECUTE 时同时显示 R2 = 5、R3 = 7、ALU Result = 12。R1 在 WRITE BACK 才变为 12；PC 从 0x00400000 前进到 0x00400004。
- SUB 默认得到 −2，MOV 得到 5；算术和 MOV 的 MEMORY 明确跳过访存，Data Memory 保持未启用。
- LOAD 在 MEMORY 读取 Memory[0x1000] = 42，绿色线路显示 42，WRITE BACK 才写入 R1。
- STORE 在 MEMORY 修改真实内存，从该步骤回退到 EXECUTE 恢复写入前的内存。STORE 不写寄存器，最终完成步骤推进 PC。
- 五种指令的每一步均在浏览器中前进后逐步回退；PC、IR、ALU 输入输出、控制信号、全部寄存器、内存、线路均与先前观察点一致。Reset 恢复本条指令的起点。
- 连续执行 ADD → STORE → LOAD R4 后，R1、Memory[0x1000]、R4 均为 12，PC 连续前进 12 字节。
- 实验页修改 R2 = 9 后自动播放得到 R1 = 16；修改 Memory[0x1000] = 99 后 LOAD 得到 99。Pause 保持当前 CPU 状态，Play 恢复执行。
- 未对齐的 LOAD 地址显示错误，实际 CPU 状态不变。非法指令、寄存器和内存输入同样不会截断或悄然修改状态。
- 九个外壳、标签、十八条静态线路、方向箭头和 DATA / ADDRESS / CONTROL / MEMORY 图例完整显示。Hover、选中、相机聚焦和其他模块淡化继续有效，选择组件时实时 Inspector 仍显示。
- 单步暂停期间线路粒子继续演示当前数据传播；步骤切换、回退和重播会重新开始对应动画，CPU 快照由统一状态管理。
- 独立浏览器生产预览检查无运行时错误、资源请求失败或 404。教学标签切换、首页往返与 HashRouter 刷新正常。
- 1440px、1024px、768px、390px 宽度检查无横向溢出；手机可选择组件并操作六步播放控制。十六进制有效地址保持单行显示。
- 六步明确为同一指令的教学观察点，不代表六个时钟周期或六级流水线。IR 是教学展示点，Write Back 是结果选择器。控制信号自 DECODE 起保持本条指令的译码结果。
- 静止时按需渲染，dpr 上限为 1.5，阴影贴图为 1024，无自定义复杂 shader。首页保留 3 个已开放课程和 7 个规划中课程。

GitHub Pages 已启用，发布源为 GitHub Actions。推送到 main 后，部署工作流会安装依赖、运行现有测试、构建并发布 dist。

正式实验网址：https://agcenn.github.io/computer-architecture-visual-lab/#/lab?module=instruction

Three.js 引擎包的体积提示仍存在；生产构建成功，页面与场景分块加载。内存为按 4 字节对齐的 32 位字模型；顶部输入提供当前指令，尚未实现程序列表。
