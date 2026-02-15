console.log('[DEBUG 1] Starting imports...');

import { app, BrowserWindow, ipcMain } from 'electron';
console.log('[DEBUG 2] Electron imported');

import path from 'node:path';
console.log('[DEBUG 3] Path imported');

// import started from 'electron-squirrel-startup';
console.log('[DEBUG 4] Squirrel startup imported (commented out)');

import { bingFetcher } from './services/bingFetcher';
console.log('[DEBUG 5] bingFetcher imported');

import { imageManager } from './services/imageManager';
console.log('[DEBUG 6] imageManager imported');

import { wallpaperSetter } from './services/wallpaperSetter';
console.log('[DEBUG 7] wallpaperSetter imported');

import { scheduler } from './services/scheduler';
console.log('[DEBUG 8] scheduler imported');

import { trayManager } from './services/trayManager';
console.log('[DEBUG 9] trayManager imported');

import { configManager } from './utils/config';
console.log('[DEBUG 10] configManager imported');

import { logger } from './utils/logger';
console.log('[DEBUG 11] logger imported');

console.log('[DEBUG 12] All imports completed');

// Track if app is quitting (to distinguish close button from quit)
let isQuitting = false;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (started) {
//   app.quit();
// }

/**
 * Download and set wallpaper
 */
async function downloadAndSetWallpaper(): Promise<boolean> {
  try {
    logger.info('Starting wallpaper download and set process...');

    // 1. Fetch Bing wallpaper info
    const region = configManager.get('region');
    const bingImage = await bingFetcher.fetchLatestImage(region);

    logger.info(`Fetched Bing image: ${bingImage.enddate} - ${bingImage.copyright}`);

    // 2. Check if already downloaded today
    if (imageManager.exists(bingImage.enddate)) {
      logger.info('Wallpaper already downloaded for today, setting it...');
      const localPath = imageManager.getWallpaperPath(bingImage.enddate);

      if (localPath) {
        await wallpaperSetter.setWallpaper(localPath);

        // Show notification
        if (configManager.get('showNotifications')) {
          trayManager.showNotification(
            'Wallpaper Updated',
            'Using today\'s Bing wallpaper'
          );
        }

        return true;
      }
    }

    // 3. Download image
    logger.info('Downloading wallpaper image...');
    const localPath = await imageManager.downloadWallpaper(bingImage, bingFetcher.downloadImage.bind(bingFetcher));

    // 4. Set as wallpaper
    const success = await wallpaperSetter.setWallpaper(localPath);

    if (!success) {
      throw new Error('Failed to set wallpaper');
    }

    // 5. Save metadata
    imageManager.saveImageMetadata(bingImage, localPath, region);

    // Show notification
    if (configManager.get('showNotifications')) {
      trayManager.showNotification(
        'Wallpaper Updated',
        bingImage.copyright
      );
    }

    logger.info('Wallpaper updated successfully');
    return true;
  } catch (error) {
    logger.error('Failed to update wallpaper', error as Error);

    // Show error notification
    if (configManager.get('showNotifications')) {
      trayManager.showNotification(
        'Wallpaper Update Failed',
        'Could not download or set wallpaper'
      );
    }

    return false;
  }
}

// Create window function (used for settings UI)
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Intercept close event to hide window instead of closing app
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      logger.info('Window hidden to tray');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open the DevTools in development.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  try {
    console.log('=== App ready event fired ===');

    logger.info('Application starting...');
    console.log('Logger initialized');
    logger.info(`User data path: ${app.getPath('userData')}`);
    console.log('User data path:', app.getPath('userData'));
    logger.info(`Config: ${JSON.stringify(configManager.getAll())}`);
    console.log('Config loaded');

    // 1. Run initial download on startup
    await downloadAndSetWallpaper();

    // 2. Initialize scheduler
    scheduler.initialize(downloadAndSetWallpaper);
    logger.info(`Scheduler initialized with ${scheduler.getJobCount()} jobs`);

    // 3. Create tray icon
    trayManager.create();
    logger.info('System tray created');

    // 4. Setup manual download handler
    app.on('download-now', async () => {
      logger.info('Manual download triggered');
      await downloadAndSetWallpaper();
    });

    // 5. Setup show window handler (for tray menu items)
    app.on('show-window', () => {
      logger.info('Show window triggered from tray');
      createWindow();
    });

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application', error as Error);
    console.error('Failed to start application:', error);
  }
});

// Setup IPC handlers for renderer process
ipcMain.handle('download-now', async () => {
  return await downloadAndSetWallpaper();
});

ipcMain.handle('get-history', async () => {
  return imageManager.getHistory();
});

ipcMain.handle('get-config', async () => {
  return configManager.getAll();
});

ipcMain.handle('update-config', async (_, config) => {
  configManager.update(config);

  // Restart scheduler if schedule times changed
  if (config.scheduleTimes) {
    scheduler.restartJobs();
    logger.info('Scheduler restarted with new schedule');
  }

  return { success: true };
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  // Keep app running in background - user must quit via tray menu
  // On macOS, it's common to keep app running even without windows
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  logger.info('Application quitting...');
  trayManager.destroy();
});
