import { app, BrowserWindow, Menu, Tray, Notification } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import { configManager } from '../utils/config';

class TrayManager {
  private tray: Tray | null = null;

  /**
   * Create system tray icon
   */
  create() {
    try {
      // 根据环境选择正确的图标路径
      // 开发环境：从项目根目录的 assets/ 加载
      // 生产环境：从 resources/assets/ 加载（通过 extraResource 复制）
      const iconPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../../assets/icon.png')
        : path.join(process.resourcesPath, 'assets', 'icon.png');

      logger.info(`Loading tray icon from: ${iconPath}`);
      logger.info(`__dirname: ${__dirname}`);
      logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
      if (process.env.NODE_ENV !== 'development') {
        logger.info(`process.resourcesPath: ${process.resourcesPath}`);
      }

      this.tray = new Tray(iconPath);
      this.tray.setToolTip('Bing Wallpaper Switcher');
      this.updateContextMenu();

      logger.info('System tray icon created successfully');
    } catch (error) {
      logger.error('Failed to create tray icon', error as Error);
    }
  }

  /**
   * Update context menu
   */
  private updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Refresh Now',
        click: () => {
          logger.info('Manual refresh triggered from tray');
          this.triggerDownload();
        }
      },
      {
        label: 'View History',
        click: () => {
          logger.info('View History triggered from tray');
          this.showWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          logger.info('Settings triggered from tray');
          this.showWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          logger.info('Quit triggered from tray');
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Show main window
   */
  private showWindow(): void {
    // Emit event for main process to handle
    app.emit('show-window');
  }

  /**
   * Trigger manual download
   */
  private triggerDownload(): void {
    // This will be called from main process
    // We'll emit an event or call the download function directly
    app.emit('download-now');
  }

  /**
   * Show notification
   */
  showNotification(title: string, body: string): void {
    if (configManager.get('showNotifications')) {
      new Notification({ title, body }).show();
    }
  }

  /**
   * Destroy tray
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
