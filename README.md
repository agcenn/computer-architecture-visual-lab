# Computer Architecture Visual Lab

计算机组成原理 3D 可视化学习实验室。使用 React、TypeScript、Vite、Three.js、React Three Fiber、Drei、Tailwind CSS 和 Zustand；所有教学运算都在浏览器中完成。

当前包含课程首页、Lab 布局、3D CPU 数据通路、组件选择与相机聚焦、Inspector，以及支持 ADD、SUB、LOAD、STORE、MOV 的 Instruction Execution Visualizer。指令按照 FETCH / DECODE / REGISTER READ / EXECUTE / MEMORY / WRITE BACK 六个观察步骤执行，CPU 状态、模块高亮与线路数据同步更新。ALU、Memory、Cache、Pipeline 等独立实验会在后续阶段扩展；首页会清楚标示可用状态。

CPU 场景采用教学型单周期数据通路：左侧纵向排列 Program Counter → Instruction Memory → Instruction Register → Control Unit / Decoder，右侧展示 Register File、ALUSrc MUX、ALU、Data Memory 和 Write Back 结果选择器。线路从模块端口出发并带有方向箭头，默认灰色；当前观察步骤的 DATA、ADDRESS、CONTROL、MEMORY 分别使用黄色、蓝色、紫色和绿色。悬停高亮，点击选择后相机聚焦、其他模块淡化，Inspector 解释输入、输出与组件作用。

## 本地运行

安装 Node.js 22.12.0 或更新的兼容版本，进入包含 `package.json` 的项目目录。

```sh
npm install
npm run dev
```

打开终端显示的地址，例如：`http://localhost:5173/computer-architecture-visual-lab/`。进入 Lab 后地址为 `http://localhost:5173/computer-architecture-visual-lab/#/lab`。

```sh
npm test
npm run build
npm run preview
```

`npm test` 检查五种指令的解析、六阶段执行、完整状态回退、内存写入撤销、连续指令、32 位运算和数据通路覆盖。`npm run build` 先进行 TypeScript 检查，再生成 `dist/`，最后自动验证 Pages 的基础路径、输出文件和资源引用。`npm run preview` 用于检查生产构建，例如 `http://localhost:4173/computer-architecture-visual-lab/`。开发服务器和预览服务器仅用于本地开发，线上网站直接运行 `dist/` 的静态文件。

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

## GitHub Pages 已配置项

- `vite.config.ts`：`base: '/computer-architecture-visual-lab/'`。
- `src/main.tsx`：`HashRouter`，Lab 使用 `#/lab`，刷新时仍请求 Pages 提供的 `index.html`。
- `.github/workflows/deploy.yml`：每次 push 到 `main` 或手动运行时执行 `npm install`、测试、`npm run build`，上传 `dist/`，再部署到 `github-pages` 环境。工作流已经配置所需权限和部署并发控制。
- `scripts/check-pages.mjs`：构建后检查资源引用和本机路径。Three.js 模型使用本地程序生成的几何体，不请求外部模型、纹理或收费 API。
- `dist/`、`node_modules/` 已被 Git 忽略；需要提交 `package-lock.json` 以记录依赖版本。

将来添加图片、纹理或模型时，优先从 `src/` 导入，或用 `new URL('./asset.ext', import.meta.url).href`。`public/` 中的运行时资源使用 `import.meta.env.BASE_URL + 'models/example.glb'`；HTML 使用 `%BASE_URL%`。不要使用从域名根目录开始的资源地址。

Vite 官方文档要求项目站点配置仓库子路径；GitHub 官方文档要求在 Pages 设置中选择 GitHub Actions。参考：[Vite 静态部署](https://vite.dev/guide/static-deploy.html)、[GitHub Pages 发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 首次上传和发布

1. 登录 GitHub 的 `agcenn` 账号，打开 [创建仓库](https://github.com/new?name=computer-architecture-visual-lab&owner=agcenn&visibility=public)。Owner 选 `agcenn`，Repository name 填 `computer-architecture-visual-lab`，Visibility 选 **Public**。不要在 GitHub 初始化 README、`.gitignore` 或 License，因为本地已有项目文件。点击 **Create repository**。操作说明见 [GitHub 创建仓库文档](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)。
2. 在项目的上一级目录打开终端，执行：

```sh
cd computer-architecture-visual-lab
npm install
npm test
npm run build
git init -b main
git add .
git commit -m "Build computer architecture visual lab"
git remote add origin https://github.com/agcenn/computer-architecture-visual-lab.git
git push -u origin main
```

如果 Git 首次提交提示身份未配置，先执行下面两条命令，再重试 commit 和 push。替换为自己的 GitHub 公开邮箱或 GitHub 提供的 noreply 邮箱：

```sh
git config user.name "agcenn"
git config user.email "your-github-email@example.com"
```

HTTPS push 如出现浏览器登录提示，完成 GitHub 登录即可；不要将登录令牌写入项目或远程地址。

3. 仓库打开 **Settings → Pages → Build and deployment → Source → GitHub Actions**。本项目已经带有工作流，无需再创建模板。
4. 打开仓库 **Actions**，选择 **Deploy to GitHub Pages**。等待 `build` 和 `deploy` 变绿。首次 push 若早于 Pages 启用导致失败，启用后在 Actions 重新运行，或使用 **Run workflow** 选择 `main` 手动运行。
5. 在 **Settings → Pages** 点击 **Visit site**，或打开成功运行中的 `github-pages` 环境地址。最终网址：

   [https://agcenn.github.io/computer-architecture-visual-lab/](https://agcenn.github.io/computer-architecture-visual-lab/)

   实验室：[https://agcenn.github.io/computer-architecture-visual-lab/#/lab](https://agcenn.github.io/computer-architecture-visual-lab/#/lab)

后续更新：

```sh
npm test
npm run build
git add .
git commit -m "Update visual lab"
git push
```

每次 push 到 `main` 都会触发同一自动部署流程。当前仓库已创建并启用 GitHub Pages，发布源为 GitHub Actions；上述首次发布步骤也适用于重新创建或迁移仓库。

## 目录

```text
.github/workflows/deploy.yml  自动部署
scripts/check-pages.mjs       生产资源检查
src/components/layout/       导航、Inspector、Timeline
src/components/three/        3D 场景、模块、数据流和相机
src/data/                    课程与指令教学数据
src/experiments/instruction/ 指令实验界面
src/pages/                   Home 与 Lab
src/store/                   教学状态
src/types/                   TypeScript 类型
tests/                       教学逻辑测试
dist/                        构建结果（build 后生成）
```

`src/types/cpu.ts` 定义可按 opcode 扩展的 `Instruction` 联合类型、完整 `CPUState`、带状态快照的 `ExecutionStep` 和 `ControlSignals`。`src/data/instructions.ts` 负责五种指令的解析、32 位运算、六阶段快照生成与当前阶段数据线路；`src/data/datapath.ts` 定义九个教学模块的位置、外壳尺寸与静态线路。

`src/store/cpuStore.ts` 统一保存实际 CPU 状态、执行前快照、历史观察点、播放状态、组件选择和 `executionRevision`。Next / Previous 将相应完整快照应用到当前状态；Reset 恢复执行前快照。3D 场景与 Inspector 读取同一状态，`executionRevision` 让线路动画在切换、回退和重播时重新开始，场景自身不执行 CPU 写入。增加指令时可扩展 `Instruction`、解析与运算规则、阶段信号及测试，沿用快照恢复和播放机制。页面与布局组件继续组织课程入口、教学标签页、Inspector 和 Timeline。
