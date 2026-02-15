# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

**Bing 壁纸切换器** - 一个 Electron 桌面应用，自动下载并设置 Bing 每日壁纸为桌面背景。主要功能包括：

- **自动壁纸更新**：下载 Bing 每日壁纸并设置为桌面背景
- **定时更新**：可配置的更新时间（默认：08:00, 16:00, 00:00）
- **多地区支持**：从不同 Bing 地区获取壁纸（en-US, zh-CN）
- **系统托盘集成**：以后台运行，通过托盘图标手动更新和设置
- **最小化到托盘**：点击窗口关闭按钮（X）将窗口隐藏到托盘而非退出应用
- **开机启动**：支持 Windows 开机自动启动（可配置）
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
   - 使用 **Windows 原生 API**（PowerShell + SystemParametersInfo）
   - 完全移除了 `wallpaper` npm 包依赖
   - 通过修改注册表 + 系统刷新设置壁纸
   - 支持获取当前壁纸路径（从注册表读取）

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

**当前配置**：`vite.main.config.ts` 只需要将 `electron` 标记为 external：

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron']  // 只需 externalize electron
    }
  }
});
```

**为什么更简单？** 应用不再依赖带原生二进制的第三方包，而是直接使用 Windows 内置的 PowerShell API。

### Windows 上的壁纸设置（新实现）

使用 **Windows 原生 API** 实现壁纸设置：

```typescript
// wallpaperSetter.ts
async setWallpaper(imagePath: string): Promise<boolean> {
  const fullPath = path.resolve(imagePath);

  const command = `powershell -ExecutionPolicy Bypass -Command "`
    + `$path = '${fullPath}'; `
    + `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -Value $path; `
    + `Add-Type -TypeDefinition '...'; `
    + `[W]::SystemParametersInfo(20, 0, $path, 3)`
    + `"`;

  exec(command, { encoding: 'utf8', env: { ...process.env, CHCP: '65001' } }, callback);
}
```

**实现原理**：
1. **修改注册表**：`HKCU\Control Panel\Desktop\Wallpaper`
2. **系统刷新**：调用 `SystemParametersInfo(20, 0, path, 3)` 立即生效
3. **参数说明**：
   - `20` = SPI_SETDESKWALLPAPER（设置桌面壁纸）
   - `3` = SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE（保存到注册表 + 广播更改）

**优势**：
- ✅ 无需外部依赖（移除了 `wallpaper` npm 包）
- ✅ 使用 Windows 内置 PowerShell
- ✅ 打包配置简化（标准 ASAR 即可）
- ✅ 更小的应用体积（减少 ~500KB）
- ✅ 更快的启动速度
- ✅ 易于维护和调试

### 托盘图标打包配置

**关键配置** (`forge.config.ts`)：

```typescript
packagerConfig: {
  asar: true,
  extraResource: ['./assets']  // 将 assets 复制到 resources/（app.asar 外部）
}
```

**为什么需要 extraResource？**
- 托盘图标文件 `assets/icon.png` 需要在运行时访问
- 如果打包进 `app.asar`，路径解析会出问题
- `extraResource` 将图标复制到 `resources/assets/`（app.asar 外部）

**路径选择逻辑** (`trayManager.ts`)：

```typescript
const iconPath = process.env.NODE_ENV === 'development'
  ? path.join(__dirname, '../../assets/icon.png')  // 开发环境
  : path.join(process.resourcesPath, 'assets', 'icon.png');  // 生产环境
```

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
  - ASAR 打包已启用（标准配置）
  - `extraResource: ['./assets']` 将托盘图标复制到 resources/
  - Fuse 配置用于安全（Cookie 加密、ASAR 完整性验证、禁用 Node.js 功能）
  - 打包器：Squirrel (Windows)、ZIP (macOS)、DEB/RPM (Linux)

**生成文件**：
- `npm run package`：生成免安装的 .exe 文件夹（~200MB）
- `npm run make`：生成安装程序 setup.exe（~50MB，推荐分发）

### 开机启动功能

使用 Electron 内置 API 实现开机启动：

```typescript
// main.ts - 应用启动时设置
app.setLoginItemSettings({
  openAtLogin: configManager.get('autoStart'),
  openAsHidden: true,  // 启动时隐藏到托盘
  name: 'Bing Wallpaper Switcher'
});

// main.ts - 配置变更时更新
ipcMain.handle('update-config', async (_, config) => {
  if (config.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: config.autoStart,
      openAsHidden: true,
      name: 'Bing Wallpaper Switcher'
    });
  }
});
```

**用户界面**：设置面板中的"Start with Windows (开机启动)"复选框

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

### 问题：托盘图标不显示（打包后）

**症状**：应用正常运行，但系统托盘看不到图标。

**原因**：`assets/icon.png` 没有被打包，或路径不正确。

**解决方案**：
1. 确保 `forge.config.ts` 包含 `extraResource: ['./assets']`
2. 使用正确的环境判断路径（开发 vs 生产）
3. 重新打包应用

**验证**：
```bash
ls out/wallpaper-switcher-vibe-win32-x64/resources/assets/icon.png
```

### 问题：PowerShell 命令执行失败

**症状**：壁纸设置失败，日志显示 PowerShell 错误。

**可能原因**：
- 路径包含特殊字符
- 权限不足
- PowerShell 执行策略限制

**解决方案**：
- 使用 `-ExecutionPolicy Bypass` 绕过执行策略
- 路径变量化（`$path = '...'`）避免引号嵌套
- 使用 UTF-8 编码避免中文路径乱码

### 问题：开机启动不生效

**症状**：设置开机启动后，重启 Windows 应用未自动启动。

**验证步骤**：
1. 任务管理器 → 启动选项卡 → 查找 "Bing Wallpaper Switcher"
2. 检查注册表：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`

**解决方案**：
- 确保应用正确安装（使用 setup.exe 而非免安装版）
- 检查配置文件中 `autoStart: true`
- 重启应用触发系统设置更新

### 问题：托盘菜单项不工作/白屏（已修复）

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
[最新] - refactor: Replace wallpaper npm package with Windows native API
         - 移除 wallpaper 依赖，使用 PowerShell + SystemParametersInfo
         - 修复托盘图标打包问题（添加 extraResource 配置）
         - 实现开机启动功能（系统托盘设置界面）
         - 简化 Vite 配置（无需 externalize wallpaper）

0172d1f - fix: Fix tray menu and add minimize to tray functionality
134f384 - feat: Initial implementation of Bing Wallpaper Switcher
```

**最新重构（当前版本）**：
- ✅ 完全移除 `wallpaper` npm 包依赖
- ✅ 使用 Windows 原生 API（PowerShell + SystemParametersInfo）
- ✅ 修复托盘图标打包路径（开发/生产环境适配）
- ✅ 实现开机启动功能（通过 Electron setLoginItemSettings API）
- ✅ 简化打包配置（标准 ASAR，无需特殊处理）
- ✅ 更小的应用体积和更快的启动速度

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

1. **测试壁纸设置**：确保 PowerShell 命令正常执行（中文路径、权限等）
2. **验证托盘图标**：开发环境和打包后都要测试图标显示
3. **测试开机启动**：配置变更后检查系统启动项是否更新
4. **使用事件进行跨模块通信**：避免循环依赖（例如 main ↔ trayManager）
5. **保留最小化到托盘行为**：不要移除 close 事件拦截
6. **在 Windows 上测试**：壁纸功能在当前实现中为 Windows 特定

## 分发和部署

**推荐方式**：使用 `npm run make` 生成安装程序

```bash
npm run make
# 生成：out/make/squirrel.windows/x64/setup.exe
```

**用户安装流程**：
1. 双击 `setup.exe` 安装
2. 应用自动启动并下载今日壁纸
3. 系统托盘出现图标
4. 设置 → 勾选"开机启动" → 保存

**免安装方式**：使用 `npm run package` 生成绿色版

```bash
npm run package
# 生成：out/wallpaper-switcher-vibe-win32-x64/ 文件夹
```

用户双击 `.exe` 运行，无需安装（适合技术用户）。
