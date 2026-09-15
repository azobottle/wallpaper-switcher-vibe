# Bing Wallpaper Switcher

一个运行在 Windows 系统托盘中的 Electron 应用。它会获取 Bing 每日壁纸、下载到本地，并通过 Windows 原生 API 将图片设置为桌面背景。

## 功能

- 启动时自动获取并设置当天的 Bing 壁纸
- 按多个指定时间自动更新，默认时间为 `00:00`、`08:00` 和 `16:00`
- 系统从睡眠恢复或屏幕解锁后重新检查壁纸
- 支持美国、中国、日本、印度、巴西、法国和德国等 Bing 地区
- 在系统托盘中手动刷新、打开设置或退出应用
- 可选择是否显示桌面通知
- 可配置 Windows 开机启动
- 保存壁纸历史，并按配置自动删除旧图片和孤立文件

> 当前壁纸设置实现依赖 PowerShell、Windows 注册表和 `user32.dll`，因此应用目前仅支持 Windows。

## 使用方式

应用启动后默认在后台运行，不会自动打开主窗口。

在系统托盘中右键点击图标，可以：

- `Refresh Now`：立即获取并设置壁纸
- `View History`：打开历史记录窗口
- `Settings`：打开设置窗口
- `Quit`：彻底退出应用

关闭主窗口只会将它隐藏到托盘，不会终止应用。

## 开发

环境要求：

- Windows 10 或更高版本
- Node.js 和 npm
- 系统能够运行 PowerShell

安装依赖并启动开发环境：

```powershell
npm install
npm start
```

其他命令：

```powershell
npm run lint  # 运行 ESLint
npm package   # 生成未安装的应用目录
npm make      # 生成 Windows 安装包
```

Electron Forge 的构建产物位于 `out/`。开发模式下会自动打开 DevTools。

## 配置

配置保存在：

```text
%APPDATA%\wallpaper-switcher-vibe\config.json
```

默认配置：

```json
{
  "scheduleTimes": ["08:00", "16:00", "00:00"],
  "region": "en-US",
  "autoStart": true,
  "showNotifications": true,
  "maxHistoryCount": 30,
  "cleanupTime": "03:00"
}
```

| 字段 | 说明 |
| --- | --- |
| `scheduleTimes` | 每日更新壁纸的时间列表，格式为 `HH:mm` |
| `region` | Bing 市场地区 |
| `autoStart` | 是否随 Windows 登录启动 |
| `showNotifications` | 更新成功或失败时是否显示通知 |
| `maxHistoryCount` | 最多保留的历史记录和壁纸数量，UI 允许 `1`–`365` |
| `cleanupTime` | 每日清理任务的执行时间，格式为 `HH:mm` |

支持的地区：

- `en-US`：美国
- `zh-CN`：中国
- `ja-JP`：日本
- `en-IN`：印度
- `pt-BR`：巴西
- `fr-FR`：法国
- `de-DE`：德国

## 本地数据

所有运行数据均位于 Electron 的用户数据目录：

```text
%APPDATA%\wallpaper-switcher-vibe\
├── config.json       # 应用配置
├── history.json      # 壁纸历史元数据
├── logs\app.log      # 运行日志
└── wallpapers\       # 下载的 JPG 壁纸
```

壁纸以 Bing 返回的日期命名，例如 `20260915.jpg`。应用以日期作为去重依据，因此同一天更改地区后，已有的当日壁纸仍会被复用。

## 项目结构

```text
wallpaper-switcher-vibe/
├── assets/
│   └── icon.png
├── src/
│   ├── constants/app.ts
│   ├── services/
│   │   ├── bingFetcher.ts
│   │   ├── imageManager.ts
│   │   ├── scheduler.ts
│   │   ├── trayManager.ts
│   │   └── wallpaperSetter.ts
│   ├── types/index.ts
│   ├── utils/
│   │   ├── config.ts
│   │   └── logger.ts
│   ├── main.ts
│   ├── preload.ts
│   ├── renderer.ts
│   └── index.css
├── forge.config.ts
├── index.html
└── package.json
```

主要模块职责：

- `src/main.ts`：应用生命周期、窗口、IPC 和各服务的编排
- `src/services/bingFetcher.ts`：调用 Bing API 并下载图片
- `src/services/imageManager.ts`：图片文件、历史记录和清理策略
- `src/services/wallpaperSetter.ts`：通过 PowerShell 和 Win32 API 设置壁纸
- `src/services/scheduler.ts`：更新任务和每日清理任务
- `src/services/trayManager.ts`：托盘菜单和桌面通知
- `src/preload.ts`：向渲染进程暴露受限的 IPC 接口
- `src/renderer.ts`：历史和设置界面

## 运行流程

1. Electron 主进程读取配置并设置开机启动状态。
2. 根据所选地区请求 Bing 当日壁纸元数据。
3. 如果历史中已有相同日期的图片，直接复用本地文件；否则下载图片。
4. 调用 PowerShell 修改桌面壁纸注册表项，并通过 `SystemParametersInfo` 刷新桌面。
5. 保存历史记录，随后启动定时任务并创建系统托盘。
6. 设置变更后，相关定时任务和开机启动状态会立即更新。

## 当前限制

- 尚未配置自动化测试。
- 网络请求暂时没有超时、重试和重定向处理。
- UI 仅显示壁纸元数据，不显示图片预览。
- 目前按日期而不是“日期 + 地区”去重。
- 仅支持 Windows 单壁纸设置，不包含多显示器策略。

## License

MIT
