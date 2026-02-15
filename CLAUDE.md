# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application for switching wallpapers, built with TypeScript and Vite. The project uses Electron Forge for packaging and distribution.

## Development Commands

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

2. **Preload Script** (`src/preload.ts`)
   - Currently empty, intended for secure IPC bridge between main and renderer
   - Use `contextBridge.exposeInMainWorld()` to expose safe APIs to renderer

3. **Renderer Process** (`src/renderer.ts` + `index.html`)
   - Loaded into the BrowserWindow
   - Node.js integration is **disabled** (security best practice)
   - All Node.js access must go through the preload script via IPC

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

## Security Considerations

- Node.js integration is disabled in the renderer process
- Use contextBridge in preload script to expose APIs
- Never enable nodeIntegration in production
- ASAR packaging is enabled with integrity validation
- Electron Fuses are configured to disable Node.js CLI features

## Windows-Specific Notes

The app includes Squirrel startup handling for Windows auto-updates. If the app was launched during Squirrel update, it will exit immediately.
