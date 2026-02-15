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
      // 使用原生图标创建托盘
      const iconPath = path.join(__dirname, '../../assets/icon.png');

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
