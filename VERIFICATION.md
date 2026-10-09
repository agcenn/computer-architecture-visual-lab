# 第一阶段验证记录

验证日期：2026-10-09。

- 依赖安装成功，并生成 `package-lock.json`；项目使用公开 npm registry。
- `npm run build` 成功：TypeScript 检查、Vite 生产构建及 Pages 路径检查均通过。
- `dist/` 共生成 11 个文件；23 处生产资源引用验证通过，基础路径为 `/computer-architecture-visual-lab/`。
- `npm test`：7 项通过，0 项失败。覆盖五阶段状态、写回时机、回退与重播、源/目标寄存器重叠、输入验证，以及 32 位补码运算和标志位。
- 浏览器生产预览：3D 模型正常显示，点击 ALU 自动聚焦并显示 Inspector；内部运算可显示二进制与标志位。
- ADD 自动播放完成后 `R1 = 12`、PC = `0x00400004`；Previous 恢复写回前 `R1 = 0`；Reset 回到实验起点。
- 验证了播放速度选择、Pause 停止推进、修改操作数和非法指令提示。
- 首页与 Lab 往返、Concept / Visualization / Experiment 切换的最终构建未再出现标签清理错误。
- `#/lab` 刷新后正常加载；390px 手机宽度下页面无横向溢出。

Vite 对 Three.js 引擎包给出大于 500 kB 的体积提示；构建成功，应用和场景已经按页面/模块拆分加载。

当前完成第一阶段。其余独立实验在首页标记为下一阶段。远程 GitHub 仓库未创建或推送，线上部署状态尚未验证；首次发布请按 README 操作。
