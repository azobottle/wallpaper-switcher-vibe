# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

**Bing 壁纸切换器** - 一个 Electron 桌面应用，自动下载并设置 Bing 每日壁纸为桌面背景。主要功能包括：

- **自动壁纸更新**：下载 Bing 每日壁纸并设置为桌面背景
- **定时更新**：可配置的更新时间（默认：08:00, 16:00, 00:00）
- **多地区支持**：从不同 Bing 地区获取壁纸（en-US, zh-CN）
- **系统托盘集成**：以后台运行，通过托盘图标手动更新和设置
- **最小化到托盘**：点击窗口关闭按钮（X）将窗口隐藏到托盘而非退出应用
- **壁纸历史**：跟踪和查看已下载的壁纸

使用 TypeScript 和 Vite 构建，通过 Electron Forge 进行打包和分发。

## 开发命令

```bash
npm start              # 以开发模式启动应用（支持热重载）
npm package            # 打包应用（Windows 上生成 .exe）
npm make              # 为所有平台创建安装程序（Windows, Linux, macOS）
npm publish           # 发布应用
npm lint              # 运行 ESLint
```

**开发工作流**：
- 在终端输入 `rs` 重启主进程（快速重载，无需完全退出）
- 应用在以下位置创建 `userData` 目录：`%APPDATA%/wallpaper-switcher-vibe/`
- 下载的壁纸存储在：`userData/wallpapers/`

## 架构设计

### Electron 进程结构

应用遵循 Electron 的三进程架构：

1. **主进程** (`src/main.ts`)
   - 入口点：创建和管理 BrowserWindow
   - 处理应用生命周期事件（ready, window-all-closed, activate）
   - 包含 Windows Squirrel 启动处理，用于自动更新
   - 窗口大小：800x600，开发模式下启用 DevTools
   - **关键特性**：拦截窗口关闭事件，最小化到托盘而非退出

2. **预加载脚本** (`src/preload.ts`)
   - 当前为空，用于在主进程和渲染进程之间建立安全的 IPC 桥梁
   - 使用 `contextBridge.exposeInMainWorld()` 向渲染器暴露安全的 API

3. **渲染进程** (`src/renderer.ts` + `index.html`)
   - 加载到 BrowserWindow 中
   - Node.js 集成**已禁用**（安全最佳实践）
   - 所有 Node.js 访问必须通过预加载脚本经 IPC 进行
   - 显示壁纸历史和设置 UI

### 服务模块

应用在 `src/services/` 中采用模块化服务架构：

1. **bingFetcher.ts**：获取 Bing 壁纸元数据
   - 查询 Bing HPImageArchive API
   - 支持多个地区（en-US, zh-CN）
   - 返回图片 URL、日期、版权信息

2. **imageManager.ts**：管理壁纸存储
   - 将图片下载到 userData/wallpapers/
   - 按日期缓存图片（格式：YYYYMMDD.jpg）
   - 保存和检索图片元数据/历史
   - 检查今日壁纸是否已下载

3. **wallpaperSetter.ts**：设置桌面壁纸
   - 使用 `wallpaper` npm 包（v7.2.1）
   - 调用平台特定的壁纸设置方法
   - Windows：使用原生二进制文件，模式为 `scale: 'fit'`

4. **scheduler.ts**：管理定时更新
   - 使用 `node-cron` 进行基于 cron 的调度
   - 支持可配置的更新时间
   - 配置更改时自动重启调度器
   - 可通过 `triggerDownload()` 手动触发更新

5. **trayManager.ts**：系统托盘集成
   - 创建带右键菜单的托盘图标
   - 菜单项：立即刷新、查看历史、设置、退出
   - 使用基于事件的架构来请求窗口显示
   - 壁纸更新时显示通知

### 工具模块

- **configManager.ts** (`src/utils/config.ts`)：持久化配置存储
  - 将设置保存在 userData/config.json
  - 管理：scheduleTimes、region、autoStart、showNotifications
  - 支持配置更新和调度器重启

- **logger.ts** (`src/utils/logger.ts`)：日志工具
  - 将日志写入 userData/logs/
  - 格式：`[YYYY-MM-DDTHH:mm:ss.SSSZ] [LEVEL] message`
  - 开发模式下在控制台输出

## 重要实现细节

### Vite 配置：外部依赖

**关键**：`wallpaper` npm 包在 `vite.main.config.ts` 中被标记为 **external**：

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'wallpaper']  // wallpaper 必须为 external！
    }
  }
});
```

**为什么？** wallpaper 包使用 `__dirname` 定位平台特定的二进制文件（例如 `windows-wallpaper-x86-64.exe`）。如果 Vite 打包它，`__dirname` 会指向 `.vite/build/` 而非正确的 `node_modules/wallpaper/`，导致 ENOENT 错误。

**解决方案**：通过标记为 external，Vite 保留 import 语句，在运行时直接从 node_modules 加载包，维持正确的二进制文件路径。

### 窗口最小化到托盘

应用实现了"最小化到托盘"行为：

**main.ts**：
```typescript
let isQuitting = false;

mainWindow.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();  // 阻止窗口关闭
    mainWindow?.hide();      // 隐藏到托盘
  }
});

app.on('before-quit', () => {
  isQuitting = true;  // 真正退出时设置标志
});
```

**用户流程**：
1. 点击窗口 X 按钮 → `close` 事件触发 → `isQuitting=false` → 隐藏窗口
2. 点击托盘菜单"退出" → `app.quit()` → `before-quit` → `isQuitting=true` → 允许关闭
3. window-all-closed 处理器**不**调用 `app.quit()`（已为 Windows/Linux 移除）

### 基于事件的托盘通信

**避免** `main.ts` 和 `trayManager.ts` **之间的循环依赖**：

**trayManager.ts** 发出事件：
```typescript
private showWindow(): void {
  app.emit('show-window');  // 不直接导入 createWindow
}
```

**main.ts** 监听并处理：
```typescript
app.on('show-window', () => {
  createWindow();  // 具有正确的 HTML 加载逻辑
});
```

### Windows 上的壁纸设置

使用 `wallpaper` npm 包并指定配置：

```typescript
await setWallpaper(imagePath, { scale: 'fit' });
```

- `scale: 'fit'` 保持纵横比（对比默认的 `fill' 会拉伸图片）
- 包生成原生二进制文件：`node_modules/wallpaper/source/windows-wallpaper-x86-64.exe`
- 二进制文件调用 Windows SystemParametersInfo API

### 打包配置

- **forge.config.ts**：Electron Forge 配置及 Vite 插件
  - ASAR 打包已启用
  - Fuse 配置用于安全（Cookie 加密、ASAR 完整性验证、禁用 Node.js 功能）
  - 打包器：Squirrel (Windows)、ZIP (macOS)、DEB/RPM (Linux)
- **vite.main.config.ts**：主进程构建的 Vite 配置
- **vite.preload.config.ts**：预加载脚本构建的 Vite 配置
- **vite.renderer.config.ts**：渲染进程构建的 Vite 配置

### 入口点

构建系统在 `forge.config.ts` 中定义以下入口点：
- 主进程：`src/main.ts`
- 预加载：`src/preload.ts`
- 渲染器：`src/renderer.ts`（在 `index.html` 中引用）

### TypeScript 配置

- Target：ESNext
- Module：CommonJS（Electron 主进程必需）
- 启用严格模式的类型检查

## 已知问题和解决方案

### 问题：壁纸设置失败并报 ENOENT 错误

**症状**：`Error: spawn D:\_code\wallpaper-switcher-vibe\.vite\build\windows-wallpaper-x86-64.exe ENOENT`

**原因**：`wallpaper` npm 包被 Vite 打包，导致 `__dirname` 解析为 `.vite/build/` 而非正确的 `node_modules/wallpaper/` 路径。

**解决方案**：在 `vite.main.config.ts` 中添加 `'wallpaper'` 到 `external`：
```typescript
external: ['electron', 'wallpaper']
```

**参考**：参见 commit 134f384（初始修复）

### 问题：托盘菜单项不工作/白屏

**症状**：点击托盘菜单的设置或查看历史无反应，或显示空白窗口。

**原因**：`trayManager.ts` 创建了自己的 BrowserWindow 但未加载 HTML 内容。窗口创建逻辑在 `main.ts` 和 `trayManager.ts` 中重复。

**解决方案**：使用基于事件的架构。`trayManager` 发出 `'show-window'` 事件，`main.ts` 通过调用 `createWindow()` 处理，该方法正确加载内容。

**参考**：参见 commit 0172d1f（托盘菜单修复）

### 问题：无法将窗口最小化到托盘

**症状**：窗口打开后，没有方法将其隐藏回托盘而不退出应用。

**解决方案**：拦截窗口 `close` 事件：
- 检查 `isQuitting` 标志以区分关闭按钮和退出命令
- 如果 `!isQuitting`，阻止关闭并隐藏窗口
- 用户必须通过托盘菜单的"退出"真正退出

**参考**：参见 commit 0172d1f（最小化到托盘）

## 安全注意事项

- 渲染进程中禁用 Node.js 集成
- 在预加载脚本中使用 contextBridge 暴露 API
- 生产环境中永远不要启用 nodeIntegration
- ASAR 打包已启用并验证完整性
- Electron Fuse 配置为禁用 Node.js CLI 功能

## Windows 特定说明

应用包含 Windows Squirrel 启动处理以支持自动更新。如果应用在 Squirrel 更新期间启动，它会立即退出。

## Git 历史和重要提交

```
0172d1f - fix: Fix tray menu and add minimize to tray functionality
134f384 - feat: Initial implementation of Bing Wallpaper Switcher
```

**初始实现 (134f384)**：
- 核心壁纸下载和设置功能
- 通过在 Vite 配置中外部化 'wallpaper' 包修复壁纸设置
- 系统托盘集成及右键菜单
- 可配置时间的调度器实现
- 持久化存储的配置管理
- 已知问题：托盘菜单项不工作、窗口白屏

**托盘和窗口修复 (0172d1f)**：
- 使用基于事件的架构修复托盘菜单项（设置/查看历史）
- 从 trayManager 移除窗口创建以避免白屏
- 在关闭按钮（X）上添加最小化到托盘功能
- 使用 isQuitting 标志改进应用生命周期
- 用户必须通过托盘菜单退出（应用保持在后台）

## 开发指南

在此代码库中工作时：

1. **始终测试壁纸设置**：Vite 配置更改时 ENOENT 错误可能复现
2. **检查外部依赖**：任何带原生二进制文件的 npm 包都应考虑设为 external
3. **使用事件进行跨模块通信**：避免循环依赖（例如 main ↔ trayManager）
4. **保留最小化到托盘行为**：不要移除 close 事件拦截
5. **在 Windows 上测试**：壁纸功能在当前实现中为 Windows 特定
