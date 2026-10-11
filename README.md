# Computer Architecture Visual Lab

计算机组成原理 3D 可视化学习实验室。使用 React、TypeScript、Vite、Three.js、React Three Fiber、Drei、Tailwind CSS 和 Zustand；所有教学运算都在浏览器中完成。

当前交付为第一阶段：课程首页、Lab 布局、3D CPU 数据通路、组件选择与相机聚焦、Inspector，以及 ADD 指令的 Fetch / Decode / Register Read / Execute / Write Back 五步演示。ALU、Memory、Cache、Pipeline 等独立实验会在后续阶段扩展；首页会清楚标示可用状态。

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

`npm test` 检查指令解析、寄存器状态和阶段转换。`npm run build` 先进行 TypeScript 检查，再生成 `dist/`，最后自动验证 Pages 的基础路径、输出文件和资源引用。`npm run preview` 用于检查生产构建，例如 `http://localhost:4173/computer-architecture-visual-lab/`。开发服务器和预览服务器仅用于本地开发，线上网站直接运行 `dist/` 的静态文件。

## 实验操作

- 鼠标左键拖动旋转，滚轮缩放，右键拖动平移；点击组件查看解释与相机聚焦，使用总览按钮回到完整数据通路。
- 输入 `ADD R1, R2, R3`，初始值 `R2 = 5`、`R3 = 7`，依次观察取指、译码、寄存器读取、执行、写回，最终 `R1 = 12`。
- 使用 Previous / Next / Play / Pause / Reset，并选择 0.5x / 1x / 2x 播放速度。回退会重新计算所处阶段对应的寄存器状态；Reset 恢复本次实验起点。
- 在 Experiment 标签页修改源寄存器的操作数，或修改顶部指令，再重新开始实验。右侧寄存器表显示十进制和十六进制；3D 数据流标签同步显示本阶段传输的值。选中 ALU 并点击“查看本次内部运算”，可查看两个操作数与结果的 32 位二进制，以及 Zero / Carry / Overflow。

这里采用 32 位、三操作数 ADD 教学模型，语义为 `rd ← rs1 + rs2`，结果按 32 位表示。五个动画步骤展开同一个时钟周期内的信号传播，寄存器与 PC 在周期边界更新；IR 是用于观察指令字段的教学展示点，标准单周期数据通路通常直接把指令存储器输出送往译码器。模型不宣称模拟某个真实 ISA 的二进制编码、时序或晶体管结构。

ADD 使用 `ALUSrc = 0` 选择第二个寄存器值，通过 ALU 完成加法，再由 `MemtoReg = 0` 选择 ALU 结果，经 Write Back 返回寄存器堆；`RegWrite = 1` 允许周期结束时写入。ADD 不读写 Data Memory，其地址、读数、写数和控制线路仍以灰色显示，方便辨认访存指令会使用的通路。当前仅支持 ADD 实验。

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

`src/data/instructions.ts` 负责解析 ADD、描述各阶段并计算结果；`src/data/datapath.ts` 定义九个教学模块的位置、外壳尺寸与静态线路；`src/store/cpuStore.ts` 保存寄存器、执行前快照、播放状态和组件选择，使前进、回退和重置得到一致的状态。`src/components/three/CPUScene.tsx` 依据这些状态渲染模块、数据流和相机；页面与布局组件组织课程入口、教学标签页、Inspector 和 Timeline。教学计算与 3D 渲染可以分别扩展。
