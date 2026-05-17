# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

**Bing 壁纸切换器** - Windows Electron 桌面应用，自动下载 Bing 每日壁纸并设为桌面背景。

核心功能：定时更新、多地区支持、系统托盘、最小化到托盘、开机启动、壁纸历史管理。

技术栈：TypeScript + Vite + Electron Forge。

## 开发命令

```bash
npm start              # 开发模式（热重载）
npm package            # 打包为 .exe 文件夹（~200MB）
npm make               # 生成安装程序 setup.exe（~50MB）
npm lint               # 运行 ESLint
```

开发提示：
- 终端输入 `rs` 重启主进程
- userData 路径：`%APPDATA%/wallpaper-switcher-vibe/`
- 壁纸存储：`userData/wallpapers/`

## 架构设计

### Electron 进程

- **主进程** (`src/main.ts`)：窗口管理、应用生命周期、IPC 处理、壁纸下载
- **预加载** (`src/preload.ts`)：通过 contextBridge 暴露 `electronAPI` 给渲染进程
- **渲染进程** (`src/renderer.ts`)：历史记录和设置 UI，nodeIntegration 已禁用

### 服务模块 (`src/services/`)

单例模式，延迟初始化：

- **bingFetcher.ts**：查询 Bing HPImageArchive API
- **imageManager.ts**：下载图片、管理历史（延迟加载）、自动清理旧壁纸
- **wallpaperSetter.ts**：使用 Windows 原生 API（PowerShell + SystemParametersInfo）
- **scheduler.ts**：node-cron 定时更新和每日清理；系统唤醒时自动刷新（powerMonitor）
- **trayManager.ts**：系统托盘图标、右键菜单、通知

### 关键模式

**事件驱动通信**（避免循环依赖）：
```typescript
// trayManager 发出
app.emit('show-window');
// main.ts 处理
app.on('show-window', () => createWindow());
```

**最小化到托盘**：
```typescript
let isQuitting = false;
mainWindow.on('close', (event) => {
  if (!isQuitting) { event.preventDefault(); mainWindow?.hide(); }
});
app.on('before-quit', () => { isQuitting = true; });
```

**延迟加载配置**：首次访问时加载，避免构造函数中提前加载导致崩溃。

## 重要实现细节

### Windows 壁纸设置

使用原生 PowerShell + 注册表（无 npm `wallpaper` 包依赖）：
1. 设置注册表：`HKCU\Control Panel\Desktop\Wallpaper`
2. 调用 `SystemParametersInfo(20, 0, path, 3)` 刷新系统

简化打包：标准 ASAR 即可，无需处理原生二进制。

### 托盘图标打包

`forge.config.ts` 必须配置 `extraResource: ['./assets']`：

```typescript
// 开发环境
path.join(__dirname, '../../assets/icon.png')
// 生产环境
path.join(process.resourcesPath, 'assets', 'icon.png')
```

### 配置选项

- `scheduleTimes`：更新时间（默认 ['08:00', '16:00', '00:00']）
- `region`：Bing 地区（默认 'en-US'）
- `autoStart`：开机启动（默认 true）
- `showNotifications`：显示通知（默认 true）
- `maxHistoryCount`：最大壁纸数（1-365，默认 30）
- `cleanupTime`：清理时间（默认 '03:00'）

## 已知问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 托盘图标消失 | assets 未打包 | 检查 `extraResource: ['./assets']` |
| PowerShell 失败 | 路径特殊字符 | 使用 `-ExecutionPolicy Bypass`、UTF-8 |
| 开机启动无效 | 未正确安装 | 使用 setup.exe 安装器 |
| 历史只显示一条 | 延迟加载未实现 | 使用 `ensureHistoryLoaded()` |
| 锁屏后不再刷新 | 系统睡眠暂停定时器 | 使用 `powerMonitor.on('resume')` 监听唤醒事件 |

## 开发注意事项

1. **清理 DEBUG 日志**：`src/main.ts` 有多处 `console.log('[DEBUG]')`，发布前删除
2. **Squirrel 启动**：开发时注释掉，生产环境取消注释
3. **仅 Windows**：壁纸设置使用 Windows API
4. **无测试**：项目缺少测试框架
5. **预加载脚本**：仅暴露基础 IPC，渲染进程功能有限

## IPC 通道

- `download-now`：手动触发下载
- `get-history`：返回历史记录
- `get-config`：返回当前配置
- `update-config`：更新配置、重启调度器

## 构建输出

- `npm package`：`out/wallpaper-switcher-vibe-win32-x64/`（便携版）
- `npm make`：`out/make/squirrel.windows/x64/setup.exe`（安装版）