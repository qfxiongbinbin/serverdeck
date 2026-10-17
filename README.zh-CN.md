<div align="center">

  <img src="ServerDeck/src-tauri/icons/icon.png" alt="ServerDeck logo" width="128" height="128" />

  # ServerDeck — 远程服务器工作台

  面向 macOS 的桌面应用，聚焦 SSH、终端多标签页、SFTP、服务器观测与应用内更新。

  [![Release](https://img.shields.io/github/v/release/qfxiongbinbin/serverdeck?display_name=tag&style=for-the-badge)](https://github.com/qfxiongbinbin/serverdeck/releases)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS-black?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-Tauri%20%7C%20React%20%7C%20Rust-5b5bd6?style=for-the-badge)](#)

  语言： [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

ServerDeck 是一个面向 macOS 的远程服务器工作流桌面应用，基于 Tauri、React、TypeScript 和 Rust 构建。产品方向参考了 Termius 这类工具，当前优先聚焦于 SSH、终端多标签页和 SFTP 浏览。

## 当前范围

- 已保存主机管理，支持项目分组
- 多标签终端会话
- 支持本地 / 远程双栏的 SFTP 浏览器
- 上传、下载、删除等文件操作
- 服务器进程观测（CPU / 内存 / 磁盘）
- 终端主题与字号设置
- 基于 GitHub Release 的更新检查与下载流程

当前仓库优先支持 macOS。

## 路线图

ServerDeck 定位为**单人使用、本地优先**的服务器工作台。我们不追求与 Termius 功能对齐，而是聚焦这类工具在个人日常开发流中做得不好的地方：把 `~/.ssh/config` 变成活数据源、跳板机链路、端口转发管理、带变量的命令片段、跟随终端工作目录的 SFTP 面板、基于 tmux 的持久会话，以及无需账号的本地优先同步。

| 里程碑 | 主题 | 规划内容 |
| --- | --- | --- |
| M1 | 连得上 | ⌘K 快速连接、`~/.ssh/config` 活数据源与跳板链、密钥与 known_hosts 管理、主机多地址与环境标识 |
| M2 | 干活顺 | 端口转发管理器、带变量的命令片段、tmux 持久会话、分屏与工作区模板 |
| M3 | 传得准 | SFTP 跟随终端工作目录、路径书签与传输队列、远端文件直接编辑、目录对比与单向同步 |
| M4 | 可延展 | CLI、面向外部 Agent 的 MCP Server、无账号本地优先同步与导出、审计历史 |

当前重点：**M1 —— ⌘K 快速连接与 `~/.ssh/config` 活数据源。**

设计上明确不做：团队 Vault 与多人协作、移动端 App、多协议支持（Telnet/RDP/VNC）、依赖账号的云同步、内置 AI 聊天助手；AI 工作流通过后续的 CLI / MCP 交给外部 Agent 完成。

详细规划维护在内部知识库；已发布的变化见 [`docs/changelog.md`](docs/changelog.md)。

## Agent 接口与 CLI

应用运行期间，ServerDeck 会暴露一个「仅当前用户可访问」的本地 socket
（`~/.serverdeck/agent.sock`，权限 `0600`），脚本和编码 Agent 可以直接复用
已保存的主机、密钥与跳板机配置，不用在 prompt 里硬编码连接信息。

```bash
cd ServerDeck
npm run serverdeck -- ping                    # 检查应用是否在运行
npm run serverdeck -- list                    # 列出已保存主机
npm run serverdeck -- exec <host> -- "df -h"  # 在远端执行一条命令
```

`<host>` 支持主机名、地址或 id；CLI 的退出码即远端命令的退出码。
可用 `SERVERDECK_SOCKET` 覆盖 socket 路径。基于同一 socket 的 MCP server 是下一步计划。

## 仓库结构

- `ServerDeck/` — 应用源码
- `ServerDeck/src/` — React UI、主题预设、API 封装与样式
- `ServerDeck/src-tauri/` — Rust 后端、Tauri 配置、图标与桌面命令
- 产品和技术规划文档维护在知识库 `工作/serverdeck/` 下
- `docs/release-process.md` — 版本发布与 GitHub Release 流程
- `docs/changelog.md` — 每个已发布版本的变更说明

## 本地开发

环境要求：

- Node.js `20+`
- Rust 工具链

本地运行：

```bash
cd ServerDeck
npm install
npm run tauri dev
```

常用命令：

```bash
npm run build                  # 前端构建
./node_modules/.bin/tsc --noEmit
cd src-tauri && cargo check
```

## 打包

构建 macOS 安装产物：

```bash
cd ServerDeck
npm run tauri build
```

当前配置的打包目标包括：

- `.app`
- `.dmg`

## 发布与更新

发布通过 GitHub Actions 基于 Git tag 构建。桌面应用会在启动时检查最新的 GitHub Release，只有发现新版本时才会显示 `Update` 按钮。

发布步骤文档见：

- `docs/release-process.md`

## 说明

- 当前通过 GitHub 分发的 macOS 构建，在其他机器上顺畅安装仍可能需要完善 Apple 签名与公证。
- 贡献协作流程请参考 `AGENTS.md`。

## 开源协议

本项目采用 Apache License 2.0 开源，详见 `LICENSE`。
