# Instruction、Cache 与 Pipeline Visualizer 验证记录

验证日期：2026-10-13。

Instruction Execution Visualizer 支持 ADD、SUB、LOAD、STORE、MOV；Cache 与 Pipeline 已接入现有 Lab 课程入口。保留浅色界面和九模块教学型 CPU 数据通路，所有模拟与教学调度在浏览器中完成。

- `npm run build` 成功：TypeScript、Vite 生产构建及 GitHub Pages 路径检查通过。`dist/` 生成 23 个文件，42 处生产资源引用通过检查，base 为 `/computer-architecture-visual-lab/`。
- `npm test`：56 项通过。其中 24 项覆盖五种指令与数据通路，16 项覆盖 Cache，16 项覆盖 Pipeline。已有 CPU 与 Cache 测试全部保留。

## 配图与精简验证

- 新增处理器、缓存与流水线三张概念插画；1600 × 900 WebP 共 147,878 字节。首页首屏与三个课程封面使用图片，指令和数据通路卡片保留准确代码图示。
- 配图使用正常 Vite import；生产预览与 GitHub Pages 子路径下的图片 URL 指向 `/computer-architecture-visual-lab/assets/`。非首屏图片使用 lazy loading，设置固有宽高与异步解码。
- 首页保留 5 个实验和交互 CPU，去除重复宣传区；5 个规划模块默认折叠。1440、1024、768、390px 下图片完整加载，无页面横向溢出。
- Cache / Pipeline 的长说明默认折叠，展开后显示完整概念图与教学边界；没有隐藏实时状态、缓存表、命中率、RAW 读取与写回周期或操作控件。手机展开说明后可滚动到全文，底部控件不遮挡内容。
- Instruction 保留 PC、当前指令、ALU 输入输出、控制信号、寄存器和内存；EXECUTE 仍显示 5、7、12。原理页保留三张要点卡，模型边界放入可展开说明。
- README 从 173 行精简到 47 行，加入实际网站预览。完整运行与部署步骤迁入 `docs/DEPLOYMENT.md`，实验语法、边界、扩展结构和教学依据迁入 `docs/MODELS.md`；生成工具与完整提示词记录在 `docs/VISUAL_ASSETS.md`。
- 生产预览重新完成图片加载、展开说明、课程切换、Pipeline 七周期及回退检查，没有运行错误或失败资源；Cache 的地址传输动画、访问快照和预设统计亦按既有脚本复查。

## Pipeline 验证

- IF / ID / EX / MEM / WB 的 3D 外壳、独立颜色、箭头和四个级间寄存器完整显示；模型、Inspector 与时序图共用不可变的 CycleSnapshot。
- 默认 ADD、SUB、LOAD 的排程为七个周期：Cycle 3 的 ADD 位于 EX、SUB 位于 ID、LOAD 位于 IF。浏览器核对了 Cycle 0 到 7 的全部流水级占用与当前时序列，逐周期回退后状态完全一致。
- Cycle 3 检测 SUB 读取 R1 的 RAW，生产者 ADD 此时在 EX、到 Cycle 5 才 WB。SUB 的 Cycle 3 / ID 单元格标红，3D ID 外壳和标签同时显示 RAW R1。回退到 Cycle 2 会消除本次检测；之后保留检测记录，不误称较早的读取问题已被写回自动修复。
- 同周期 WB 先写、ID 后读的边界例子未报 RAW；距离更近且读取较早时报告 RAW。检测使用最近的较早写入者，覆盖 LOAD 基址和 STORE 数据 / 基址；STORE 不产生寄存器写入。
- 点击时序行、任意阶段单元格或当前 3D 指令，会选中同一指令的五级完整路径；其他当前指令淡化。选择不修改周期和冒险状态。
- 两条 RAW 示例和三条独立指令预设均可加载；编辑非法寄存器 R8 时保留当前有效程序、周期和选择。支持最多 8 条 ADD / SUB / LOAD / STORE / MOV，十进制或十六进制有符号位移。
- Play / Pause / Previous / Next / Reset 使用统一周期状态。2× 自动播放在最后一个周期停止；Pause 保持各级占用、冒险记录和时序图不变。Reset 回到 Cycle 0 并取消选择。
- 1440px、1366px、1024px、768px、390px 宽度无页面横向溢出。手机表格内部滚动，当前周期列在切换或调整窗口后自动进入可见范围；五个 3D 标签不互相覆盖，手机阶段字母为 14px。
- 默认三条指令的时序行在 1440 × 1120 桌面视口中完整可见；较矮窗口提供主列滚动，播放控制持续可用。
- 3D 标签由外层 React 统一管理，场景只投影坐标。重复 Pipeline ↔ Cache 切换与刷新未出现 DOM 卸载错误；生产预览完整浏览器检查没有运行时错误、失败资源请求或 404。
- 离开 Pipeline 会暂停周期播放；进入 Pipeline 会暂停原 Instruction CPU，切回时原 EXECUTE 阶段及 ALU Result = 12 保持。首页提供 5 个已开放课程、5 个规划中课程，HashRouter 刷新正常。
- 排程器与 placements、依赖检测、周期快照、事件及界面分别组织。注入测试调度器延长 ID 并发出 stall 事件后，快照能反映等待；时序图按 placements 渲染。预留 forward / stall / branch-prediction 事件类型，当前 UI 只启用理想调度与 RAW 检测。
- Pipeline 展示多条指令的实际周期重叠，不等同于 Instruction 实验的一条单周期指令六个观察点。仅检测冒险，不计算依赖指令的寄存器结果，不将未处理冒险的理想排程解释为正确执行。

## Cache 验证

- 16 位字节地址、4 行直接映射、每块 4 字节，共 16 字节数据容量。地址拆分为 Tag 12 位、Index 2 位、Offset 2 位。`0x1234` 显示 `0001 0010 0011 0100`，Tag 为 `0x123`，Index 为 1，Offset 为 0。
- 缓存初始四行无效。有效地址输入会预览选中行和块内字节；实际访问按地址发出、拆分、索引、比较执行，比较前不提前显示 Hit / Miss 或后续分支。
- Hit 走五个观察阶段，直接 Cache → CPU；Miss 走七个观察阶段，经请求主存、主存回填完整块、返回 CPU。计数只在返回字节后更新。
- 冷访问 `0x1234` 在回填阶段将 Line 1 设置为 Valid = 1、Tag = `0x123`、Data = `DD EA F7 04`。比较信息继续显示查找时的旧有效位与标签，避免将填充后的标签误当成命中依据。
- 预设 `0x1000 → 0x1004 → 0x1000 → 0x2000 → 0x1004` 得到 Miss / Miss / Hit / Miss / Hit，命中率依次为 0%、0%、33.3%、25%、40%。最终 Hit = 2、Miss = 3，Line 0 的 Tag = `0x200`，Line 1 的 Tag = `0x100`。
- 预设的 31 个观察点全部在浏览器逐步前进、逐步逆序恢复；缓存行、有效位、Tag、每个字节、CPU 返回值、统计和已完成访问记录都与先前观察点一致。逆序恢复不会展示未来访问记录；重新前进不会重复计数。
- 完成 `0x1000` 后访问 `0x1001` 命中，Offset = 1，CPU 返回 `0x24`。`0x2000` 与 `0x1000` 映射到相同行并替换旧块；预设结束后再访问 `0x1000` 会 Miss。
- `0xFFFF` 映射到 Line 3、Tag = `0xFFF`、Offset = 3，返回 `0xE9`；最后一个块不会越过 16 位主存边界。`0x10000` 等非法输入显示错误，缓存和统计不被修改。
- 地址与数据传输粒子确实随时间移动；拆分字段、索引行、比较标签和整块填充分别有动画。Pause 同时冻结播放进度与 CSS 动画；0.5× / 1× / 2× 速度同步影响观察阶段和线路动画。2× 自动播放完整预设得到 2 Hit、3 Miss、40%。
- 每次 Next / Previous 以同一个 CacheState 快照和 revision 更新表格、Inspector 与动画；修改未完成访问会先恢复该访问起点。Reset 和“清空并载入预设”都恢复空缓存。
- 1440px、1024px、768px、390px 宽度无页面或表格横向溢出。较矮窗口与手机会在切换阶段时滚动到当前字段、缓存或数据传输区域，底部播放控制保持可用。
- Cache 按需加载；从正在播放的 Instruction 实验切入 Cache 会暂停原 CPU，切回时保持原 EXECUTE 状态，ADD 结果仍为 12。
- 生产预览的 Cache HashRouter 刷新正常；完整浏览器检查未发现运行时错误、失败资源请求或 404。独立参考模型核对 200 次确定性地址访问，缓存内容、返回字节和统计一致。
- Cache 为只读教学模型，使用固定样例字节，不模拟硬件延迟、写策略或多级缓存；与 Instruction 的 32 位字内存分开管理。步骤是访问过程的观察点，不是硬件时钟周期。

## Instruction 与 CPU 验证

保留此前五指令完整验证记录；新增 Cache 后复查了 ADD、课程切换、动画播放隔离与生产加载。

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
- 静止时按需渲染，dpr 上限为 1.5，阴影贴图为 1024，无自定义复杂 shader。

GitHub Pages 已启用，发布源为 GitHub Actions。推送到 main 后，部署工作流会安装依赖、运行现有测试、构建并发布 dist。

正式实验网址：https://agcenn.github.io/computer-architecture-visual-lab/#/lab?module=instruction

Cache 实验网址：https://agcenn.github.io/computer-architecture-visual-lab/#/lab?module=cache

Pipeline 实验网址：https://agcenn.github.io/computer-architecture-visual-lab/#/lab?module=pipeline

Three.js 引擎包的体积提示仍存在；生产构建成功，页面与场景分块加载。内存为按 4 字节对齐的 32 位字模型；顶部输入提供当前指令，尚未实现程序列表。
