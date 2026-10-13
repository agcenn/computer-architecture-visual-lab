# 教学模型与实验操作

## 实验操作

- 鼠标左键拖动旋转，滚轮缩放，右键拖动平移；点击组件查看解释与相机聚焦，使用总览按钮回到完整数据通路。
- 输入 `ADD R1, R2, R3`，初始值 `R2 = 5`、`R3 = 7`，依次观察六个步骤。EXECUTE 时线路同时显示 `5`、`7`、`12`，WRITE BACK 后 `R1 = 12`。
- 使用 Previous Step / Next Step / Play / Pause / Reset，并选择 0.5x / 1x / 2x 播放速度。Previous 恢复上一观察点的完整 CPU 快照，包括 PC、寄存器、内存、当前指令、ALU 输入输出与控制信号。STORE 在 MEMORY 写入内存，回到 EXECUTE 会撤销该写入；WRITE BACK 回退也会恢复 PC 和目标寄存器。
- Reset 恢复**本条指令开始前**的状态，而不是清空所有已经完成的指令。完成后点击“重播”或再次 Run，会从同一执行前快照重新演示本条指令，避免重复累加或再次推进 PC。
- 完成一条指令后，选择或输入下一条指令会保留已提交的 PC、寄存器和内存。例如先完成 ADD，再执行 `STORE R1, [0x1000]`，随后执行 `LOAD R4, [0x1000]`，可观察 `12` 从 ALU 经寄存器、内存回到 R4。每条完成后 PC 前进 4 字节。
- 在“实验”标签页修改源寄存器或 LOAD / STORE 的内存值，按 Enter 或离开输入框应用。执行尚未完成时，修改有效指令、寄存器或内存会先恢复本条指令的执行前状态，再应用修改；已完成的指令结果会保留。播放过程中输入值编辑器暂停使用，点击 Pause 后可修改。
- Inspector 持续显示当前阶段、实际 PC、Current Instruction、寄存器、内存、ALU 输入输出与译码后的控制信号。选中 ALU 并点击“查看 32 位表示”，可查看 32 位二进制与 Zero / Carry / Overflow；SUB 的 Carry 表示无无符号借位。

支持的语法与默认结果如下；指令大小写不敏感，寄存器范围为 R0–R7，所有寄存器均可写。

| 指令示例 | 语义 | 默认初始状态下的结果 |
| --- | --- | --- |
| `ADD R1,R2,R3` | `R1 ← R2 + R3` | `R1 = 12` |
| `SUB R1,R2,R3` | `R1 ← R2 − R3` | `R1 = -2` |
| `LOAD R1,[0x1000]` | `R1 ← Memory[0x1000]` | `R1 = 42` |
| `STORE R1,[0x1000]` | `Memory[0x1000] ← R1` | 初始 `R1 = 0`，该内存字变为 `0` |
| `MOV R1,R2` | `R1 ← R2` | `R1 = 5` |

这里采用 32 位教学模型，初始 PC 为 `0x00400000`。整数输入范围为 −2147483648 至 4294967295，按低 32 位、二进制补码表示；有符号溢出不会中止教学运算。内存是稀疏的 **32 位字模型**：LOAD / STORE 使用绝对地址，地址须为 0 至 `0xFFFFFFFC` 范围内且按 4 字节对齐；未设置的内存字读取为 `0`。默认 `Memory[0x1000] = 42`、`Memory[0x1004] = 0`。

六个动画步骤展开同一条单周期指令的数据传播，并非六个时钟周期或六级流水线。寄存器与 PC 在 WRITE BACK 观察点展示周期边界提交；STORE 的 MEMORY 观察点展示内存写入。IR 是用于观察指令字段的教学展示点，标准单周期数据通路通常直接把指令存储器输出送往译码器。顶部输入代表当前 PC 处的教学指令，尚未实现程序列表。模型不宣称模拟某个真实 ISA 的二进制编码、精确时序或晶体管结构。

控制信号在 DECODE 后显示译码结果，并在本条指令的后续观察步骤保持稳定。ADD / SUB 使用 `ALUSrc = 0`，MOV 使用 ALU 的 `PASS` 操作，这三种指令通过 `MemtoReg = 0` 选择 ALU 结果；它们在 MEMORY 明确标示跳过访存，Data Memory 保持灰色。LOAD / STORE 使用 `ALUSrc = 1`，由 ALU 计算 `0 + 绝对地址`；LOAD 使用 `MemRead = 1` 与 `MemtoReg = 1`，STORE 使用 `MemWrite = 1` 与 `RegWrite = 0`。动画只高亮当前观察点对应的控制与数据线路，不把这些观察步骤模拟成独立硬件周期。

单周期传播与周期边界写入的教学依据见 [Berkeley CS61C Datapath](https://notes.cs61c.org/content/datapath/)；ALUSrc、MemtoReg 等控制信号及运算/访存通路见 [FSU Single-Cycle Datapath](https://www.cs.fsu.edu/~jayarama/org2sp19/Slides/Datapath.pdf)。

## Cache 实验

打开 `#/lab?module=cache`，观察 CPU → L1 Cache → Main Memory 的 2.5D 模型。参数固定为 16 位**字节地址**、4 行、每块 4 字节，缓存初始全部无效；读取一个字节时，Miss 会从主存回填整个 4 字节块。

地址拆分为 **Tag 12 位 / Index 2 位 / Offset 2 位**。输入 `0x1234` 显示二进制 `0001 0010 0011 0100`，Tag 为 `0x123`、Index 为 `1`、Offset 为 `0`；对应主存块为 `0x1234`–`0x1237`。输入有效地址时会预览并高亮对应缓存行，实际访问从 CPU 发出地址开始。

按 Next 逐步观察地址发出、地址拆分、Index 选行、Valid 与 Tag 比较。Hit 沿 Cache → CPU 返回所需字节；Miss 沿 CPU 请求主存 → Memory 回填 Cache → Cache 返回 CPU，填充时更新 Valid、Tag 和四个 Data 字节，Offset 选择其中一个。Hit 要同时满足 `Valid = 1` 和标签相等。

“清空并载入预设”从空缓存开始执行 `0x1000 → 0x1004 → 0x1000 → 0x2000 → 0x1004`，结果为 **Miss / Miss / Hit / Miss / Hit**，累计命中率依次为 **0% / 0% / 33.3% / 25% / 40%**。`0x1000` 与 `0x2000` 映射到 Line 0，标签不同，所以访问后者时替换前者；Line 1 的 `0x1004` 仍在缓存中。刚完成 `0x1000` 的访问后，紧接着访问 `0x1001` 可以观察同一块内不同 Offset 的命中；预设结束后再次访问已被替换的 `0x1000` 则会 Miss。

Hit、Miss、Hit Rate 在数据返回 CPU、一次访问完成后更新，避免单步或重播重复计数。Previous 恢复缓存行、统计和 CPU 收到的数据；Reset 清空缓存与本次访问记录。自动播放可以暂停，逐步执行使用同一份状态与动画阶段。

Main Memory 的值是固定的教学示例字节：`((address & 0xFF) * 13 + (address >>> 8) * 17 + 7) & 0xFF`，方便重复实验时核对数据；它与指令实验的 32 位字内存分别建模。此实验只读，展示命中、整块回填、空间局部性和直接映射替换，不模拟真实硬件延迟或写策略。Cache 较小、访问较快，保存近期使用的数据副本，从而减少向较慢主存请求数据的次数。

参考：[Berkeley CS61C Direct-mapped Caches](https://notes.cs61c.org/content/caches-ii/direct-mapped/)、[Cornell CS3410 Caches](https://www.cs.cornell.edu/courses/cs3410/2026sp/notes/caches.html)。

## Pipeline 实验

打开 `#/lab?module=pipeline`，上方是五级 CPU Pipeline 3D 模型，下方是 Pipeline Timing Diagram。IF / ID / EX / MEM / WB 分别表示取指、译码与读寄存器、执行、访存和写回，各有独立颜色。流水级之间的 IF/ID、ID/EX、EX/MEM、MEM/WB 寄存器保存跨周期传递的信息。

默认程序是 `ADD R1,R2,R3`、`SUB R4,R1,R5`、`LOAD R6,0(R2)`。理想调度每周期发射一条指令，每条占五级；3 条指令共需 7 个周期。Cycle 3 时 ADD 在 EX、SUB 在 ID、LOAD 在 IF。Cycle 0 表示尚未发射。

Previous Cycle / Next Cycle / Play / Pause / Reset 共用周期快照。切换周期会同时更新 3D 模型、当前时序列、各级占用和已检测冒险。点击某条指令，可高亮它从 IF 到 WB 的完整路径；支持从图表、指令列表或 3D 当前指令选择。

首版使用**理想流水调度，仅检测冒险**。SUB 在 Cycle 3 的 ID 阶段需要读取 R1，而较早的 ADD 要到 Cycle 5 的 WB 才提供 R1，形成 RAW（Read After Write）冒险。图表在发生读取的单元格标红，并显示寄存器 R1、生产者、消费者和写回周期；之后保留该检测记录，回退到读取之前会恢复未检测状态。检测本身不会改变排程，也不宣称依赖指令已正确计算；尚未处理的数据依赖需要后续 forwarding 或 stall 机制。

本模型采用同一周期先 WB 写入、再 ID 读取的寄存器堆约定。因此生产者 WB 与消费者 ID 同周期时可以安全读取；检测会选择每个源寄存器最近的较早写入指令。LOAD 的基址寄存器、STORE 的基址与存储数据寄存器都属于读取源。

可输入最多 8 条 ADD / SUB / LOAD / STORE / MOV 指令，一行一条，寄存器为 R0–R7。LOAD / STORE 使用 `位移(基址)`，例如 `LOAD R6,0(R2)`、`STORE R1,4(R2)`；与前面的单指令实验各自使用适合教学目标的语法。程序编辑不会在应用之前修改排程；非法输入保留当前有效程序。

调度器、周期快照、依赖检测与界面渲染分别建模，为后续加入 Forwarding、Stall 和 Branch Prediction 保留扩展位置；当前不显示可开启但尚未实现的策略开关。

教学依据：[Berkeley CS61C 五级流水](https://notes.cs61c.org/content/pipeline/five-stage-pipeline/)、[Berkeley CS61C 数据冒险](https://notes.cs61c.org/content/pipeline-hazards/data-hazards/)、[Cornell CS3410 流水线与寄存器堆时序](https://www.cs.cornell.edu/courses/cs3410/2017sp/schedule/slides/06-pipeline.pdf)。

## 目录

```text
.github/workflows/deploy.yml  自动部署
scripts/check-pages.mjs       生产资源检查
src/components/layout/       导航、Inspector、Timeline
src/components/three/        3D 场景、模块、数据流和相机
src/data/                    课程与指令教学数据
src/experiments/instruction/ 指令实验界面
src/experiments/cache/       Cache 实验界面与 2.5D 动画
src/experiments/pipeline/    流水线界面、3D 模型与时序图
src/pages/                   Home 与 Lab
src/store/                   教学状态
src/types/                   TypeScript 类型
tests/                       教学逻辑测试
dist/                        构建结果（build 后生成）
```

`src/types/cpu.ts` 定义可按 opcode 扩展的 `Instruction` 联合类型、完整 `CPUState`、带状态快照的 `ExecutionStep` 和 `ControlSignals`。`src/data/instructions.ts` 负责五种指令的解析、32 位运算、六阶段快照生成与当前阶段数据线路；`src/data/datapath.ts` 定义九个教学模块的位置、外壳尺寸与静态线路。

`src/store/cpuStore.ts` 统一保存实际 CPU 状态、执行前快照、历史观察点、播放状态、组件选择和 `executionRevision`。Next / Previous 将相应完整快照应用到当前状态；Reset 恢复执行前快照。3D 场景与 Inspector 读取同一状态，`executionRevision` 让线路动画在切换、回退和重播时重新开始，场景自身不执行 CPU 写入。增加指令时可扩展 `Instruction`、解析与运算规则、阶段信号及测试，沿用快照恢复和播放机制。页面与布局组件继续组织课程入口、教学标签页、Inspector 和 Timeline。

`src/types/cache.ts` 定义地址字段、缓存行、访问快照和阶段类型；`src/data/cache.ts` 提供地址拆分、教学内存与纯函数访问模拟；`src/store/cacheStore.ts` 管理缓存、统计、预设序列与可逆访问历史。`src/experiments/cache/CacheVisualizer.tsx` 从同一状态渲染字段、缓存表、Inspector 和线路动画。Cache 页面按需加载，离开实验会暂停自动播放。

`src/types/pipeline.ts` 定义指令读写集、流水级占用、RAW 记录、周期快照、调度器和事件类型。`src/data/pipeline.ts` 将调度器给出的 `placements` 与依赖检测投影为不可变的 `CycleSnapshot`；`src/store/pipelineStore.ts` 统一管理周期、选择和播放状态。时序图和 3D 场景直接读取相同快照与 placements，不各自计算理想排程。后续可替换 `PipelineScheduler`，使用 stall / forward / branch-prediction 事件扩展策略，沿用展示与回退结构。
