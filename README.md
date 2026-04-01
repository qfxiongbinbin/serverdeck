# 远程服务器桌面应用

目标：做一个面向 macOS 的远程服务器桌面应用，第一版参考 Termius/Terminus 的高频能力，但不做全量复刻。

## 当前产出

- 产品方向与 MVP 拆解
- 技术路线与模块边界
- `ServerDeck/` 项目骨架
- 可直接继续开发的 Host / SFTP 工作台界面原型

## 为什么先这样做

当前机器环境里：

- `Rust` 可用
- `Node` 版本是 `v14.15.0`
- `pnpm` 需要更高版本的 Node
- `cargo tauri` 尚未安装

所以这一版先手工搭骨架，不依赖在线脚手架，避免环境阻塞。

## 目录

- `产品方案.md`：产品定位、MVP、页面结构
- `技术方案.md`：Tauri 架构、SSH/SFTP 实现建议、安全边界
- `ServerDeck/`：实际项目代码骨架

## 下一步

1. 升级本机 Node 到 `18.12+`，建议直接用 `20 LTS`
2. 安装 `pnpm`
3. 安装 `cargo-tauri`
4. 在 `ServerDeck/` 下执行依赖安装和本地运行
5. 先接通 Host 持久化，再接 SSH 会话，再接 SFTP
