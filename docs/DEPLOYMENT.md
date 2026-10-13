# 开发与 GitHub Pages 部署

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

`npm test` 检查五种指令的解析、六阶段执行、完整状态回退、内存写入撤销、连续指令、32 位运算和数据通路覆盖；也检查 Cache 地址拆分、命中、整块填充、替换、预设统计与跨访问回退，以及 Pipeline 排程、RAW 检测、周期快照和调度器扩展。`npm run build` 先进行 TypeScript 检查，再生成 `dist/`，最后自动验证 Pages 的基础路径、输出文件和资源引用。`npm run preview` 用于检查生产构建，例如 `http://localhost:4173/computer-architecture-visual-lab/`。开发服务器和预览服务器仅用于本地开发，线上网站直接运行 `dist/` 的静态文件。

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
