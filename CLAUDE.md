# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bing Wallpaper Switcher** - An Electron desktop application that automatically downloads and sets Bing's daily wallpaper as your desktop background. Features include:

- **Automatic Wallpaper Updates**: Downloads Bing's daily wallpaper and sets it as desktop background
- **Scheduled Updates**: Configurable update times (default: 08:00, 16:00, 00:00)
- **Multi-Region Support**: Fetch wallpapers from different Bing regions (en-US, zh-CN)
- **System Tray Integration**: Runs in background with tray icon for manual updates and settings
- **Minimize to Tray**: Clicking window close button (X) hides window to tray instead of quitting
- **Wallpaper History**: Track and view previously downloaded wallpapers

Built with TypeScript and Vite, using Electron Forge for packaging and distribution.

## Development Commands

```bash
npm start              # Start application in development mode with hot reload
npm package            # Package application (creates .exe on Windows)
npm make              # Create installers for all platforms (Windows, Linux, macOS)
npm publish           # Publish application
npm lint              # Run ESLint
```

**Development Workflow**:
- Type `rs` in terminal to restart main process (quick reload without quitting)
- Application creates `userData` directory at: `%APPDATA%/wallpaper-switcher-vibe/`
- Downloaded wallpapers stored in: `userData/wallpapers/`

```bash
npm start              # Start the application in development mode with hot reload
npm package            # Package the application (creates .exe on Windows)
npm make              # Create installers for all platforms (Windows, Linux, macOS)
npm publish           # Publish the application
npm lint              # Run ESLint
```

## Architecture

### Electron Process Structure

The application follows Electron's three-process architecture:

1. **Main Process** (`src/main.ts`)
   - Entry point: Creates and manages the BrowserWindow
   - Handles application lifecycle events (ready, window-all-closed, activate)
   - Includes Windows Squirrel startup handling for auto-updates
   - Window size: 800x600, DevTools enabled in development
   - **Key feature**: Intercepts window close event to minimize to tray instead of quitting

2. **Preload Script** (`src/preload.ts`)
   - Currently empty, intended for secure IPC bridge between main and renderer
   - Use `contextBridge.exposeInMainWorld()` to expose safe APIs to renderer

3. **Renderer Process** (`src/renderer.ts` + `index.html`)
   - Loaded into the BrowserWindow
   - Node.js integration is **disabled** (security best practice)
   - All Node.js access must go through the preload script via IPC
   - Displays wallpaper history and settings UI

### Service Modules

The application uses a modular service architecture in `src/services/`:

1. **bingFetcher.ts**: Fetches Bing wallpaper metadata
   - Queries Bing HPImageArchive API
   - Supports multiple regions (en-US, zh-CN)
   - Returns image URL, date, copyright info

2. **imageManager.ts**: Manages wallpaper storage
   - Downloads images to userData/wallpapers/
   - Caches images by date (format: YYYYMMDD.jpg)
   - Saves and retrieves image metadata/history
   - Checks if today's wallpaper already downloaded

3. **wallpaperSetter.ts**: Sets desktop wallpaper
   - Uses `wallpaper` npm package (v7.2.1)
   - Calls platform-specific wallpaper setting methods
   - Windows: Uses native binary with `scale: 'fit'` mode

4. **scheduler.ts**: Manages scheduled updates
   - Uses `node-cron` for cron-based scheduling
   - Supports configurable update times
   - Auto-restarts when schedule configuration changes
   - Can manually trigger updates via `triggerDownload()`

5. **trayManager.ts**: System tray integration
   - Creates tray icon with context menu
   - Menu items: Refresh Now, View History, Settings, Quit
   - Uses event-based architecture to request window display
   - Shows notifications for wallpaper updates

### Utility Modules

- **configManager.ts** (`src/utils/config.ts`): Persistent configuration storage
  - Stores settings in userData/config.json
  - Manages: scheduleTimes, region, autoStart, showNotifications
  - Supports config updates and scheduler restart

- **logger.ts** (`src/utils/logger.ts`): Logging utility
  - Writes logs to userData/logs/
  - Formats: [YYYY-MM-DDTHH:mm:ss.SSSZ] [LEVEL] message
  - Console output in development mode

## Important Implementation Details

### Vite Configuration: External Dependencies

**Critical**: The `wallpaper` npm package is marked as **external** in `vite.main.config.ts`:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'wallpaper']  // wallpaper must be external!
    }
  }
});
```

**Why?** The wallpaper package uses `__dirname` to locate platform-specific binaries (e.g., `windows-wallpaper-x86-64.exe`). If Vite bundles it, `__dirname` points to `.vite/build/` instead of `node_modules/wallpaper/`, causing ENOENT errors.

**Solution**: By marking it external, Vite preserves the import statement and loads the package directly from node_modules at runtime, maintaining correct binary paths.

### Window Minimize to Tray

The app implements "minimize to tray" behavior:

**main.ts**:
```typescript
let isQuitting = false;

mainWindow.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();  // Prevent window closure
    mainWindow?.hide();      // Hide to tray
  }
});

app.on('before-quit', () => {
  isQuitting = true;  // Set flag when really quitting
});
```

**User Flow**:
1. Click window X button → `close` event fires → `isQuitting=false` → hide window
2. Click tray menu "Quit" → `app.quit()` → `before-quit` → `isQuitting=true` → allow close
3. Window-all-closed handler does NOT call `app.quit()` (removed for Windows/Linux)

### Event-Based Tray Communication

**Avoid circular dependency** between `main.ts` and `trayManager.ts`:

**trayManager.ts** emits event:
```typescript
private showWindow(): void {
  app.emit('show-window');  // Don't import createWindow directly
}
```

**main.ts** listens and handles:
```typescript
app.on('show-window', () => {
  createWindow();  // Has proper HTML loading logic
});
```

### Wallpaper Setting on Windows

Uses the `wallpaper` npm package with specific configuration:

```typescript
await setWallpaper(imagePath, { scale: 'fit' });
```

- `scale: 'fit'` preserves aspect ratio (vs default 'fill' which stretches)
- Package spawns native binary: `node_modules/wallpaper/source/windows-wallpaper-x86-64.exe`
- Binary calls Windows SystemParametersInfo API

### Build Configuration

- **forge.config.ts**: Electron Forge configuration with Vite plugin
  - ASAR packaging enabled
  - Fuses configured for security (cookie encryption, ASAR integrity validation, Node.js features disabled)
  - Makers: Squirrel (Windows), ZIP (macOS), DEB/RPM (Linux)
- **vite.main.config.ts**: Vite config for main process build
- **vite.preload.config.ts**: Vite config for preload script build
- **vite.renderer.config.ts**: Vite config for renderer build

### Entry Points

The build system defines these entry points in `forge.config.ts`:
- Main process: `src/main.ts`
- Preload: `src/preload.ts`
- Renderer: `src/renderer.ts` (referenced in `index.html`)

### TypeScript Configuration

- Target: ESNext
- Module: CommonJS (required for Electron main process)
- Type checking enabled with strict mode

## Known Issues and Solutions

### Issue: Wallpaper Setting Fails with ENOENT Error

**Symptom**: `Error: spawn D:\_code\wallpaper-switcher-vibe\.vite\build\windows-wallpaper-x86-64.exe ENOENT`

**Cause**: The `wallpaper` npm package was being bundled by Vite, causing `__dirname` to resolve to `.vite/build/` instead of the correct `node_modules/wallpaper/` path.

**Solution**: Add `'wallpaper'` to `external` in `vite.main.config.ts`:
```typescript
external: ['electron', 'wallpaper']
```

**Reference**: See commit 134f384 (initial fix)

### Issue: Tray Menu Items Don't Work / Blank Screen

**Symptom**: Clicking Settings or View History in tray menu does nothing or shows blank window.

**Cause**: `trayManager.ts` was creating its own BrowserWindow without loading HTML content. The window creation logic was duplicated between `main.ts` and `trayManager.ts`.

**Solution**: Use event-based architecture. `trayManager` emits `'show-window'` event, `main.ts` handles it by calling `createWindow()` which properly loads content.

**Reference**: See commit 0172d1f (tray menu fix)

### Issue: No Way to Minimize Window to Tray

**Symptom**: Once window is opened, there's no way to hide it back to tray without quitting.

**Solution**: Intercept window `close` event:
- Check `isQuitting` flag to distinguish close button from quit command
- If `!isQuitting`, prevent close and hide window
- User must use tray menu "Quit" to actually exit

**Reference**: See commit 0172d1f (minimize to tray)

## Security Considerations

- Node.js integration is disabled in the renderer process
- Use contextBridge in preload script to expose APIs
- Never enable nodeIntegration in production
- ASAR packaging is enabled with integrity validation
- Electron Fuses are configured to disable Node.js CLI features

## Windows-Specific Notes

The app includes Squirrel startup handling for Windows auto-updates. If the app was launched during Squirrel update, it will exit immediately.

## Git History and Important Commits

```
0172d1f - fix: Fix tray menu and add minimize to tray functionality
134f384 - feat: Initial implementation of Bing Wallpaper Switcher
```

**Initial Implementation (134f384)**:
- Core wallpaper download and set functionality
- Fixed wallpaper setting by externalizing 'wallpaper' package in Vite config
- System tray integration with context menu
- Scheduler implementation with configurable times
- Configuration management with persistent storage
- Known issues: tray menu items not working, window blank screen

**Tray and Window Fixes (0172d1f)**:
- Fixed tray menu items (Settings/View History) using event-based architecture
- Removed window creation from trayManager to avoid blank screens
- Added minimize to tray on close button (X)
- Improved app lifecycle with isQuitting flag
- User must quit via tray menu (app stays in background)

## Development Guidelines

When working on this codebase:

1. **Always test wallpaper setting**: The ENOENT error can resurface if Vite config changes
2. **Check external dependencies**: Any npm package with native binaries should likely be external
3. **Use events for cross-module communication**: Avoid circular dependencies (e.g., main ↔ trayManager)
4. **Preserve minimize-to-tray behavior**: Don't remove the close event interception
5. **Test on Windows**: Wallpaper functionality is Windows-specific in current implementation
