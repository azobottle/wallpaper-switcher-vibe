import { setWallpaper, getWallpaper } from 'wallpaper';
import { logger } from '../utils/logger';

/**
 * Wallpaper setter class - uses wallpaper npm package
 * Reference implementation: D:\_code\wallpaper-switcher\src\stateManager.js
 */
export class WallpaperSetter {
  /**
   * Set wallpaper from local file path
   */
  async setWallpaper(imagePath: string): Promise<boolean> {
    try {
      logger.info(`Setting wallpaper: ${imagePath}`);

      // Set wallpaper with 'fit' scale mode (same as wallpaper-switcher project)
      await setWallpaper(imagePath, { scale: 'fit' });

      logger.info('Wallpaper set successfully');
      return true;
    } catch (error) {
      logger.error('Failed to set wallpaper', error as Error);
      return false;
    }
  }

  /**
   * Get current wallpaper path
   */
  async getCurrentWallpaper(): Promise<string> {
    try {
      const currentPath = await getWallpaper();

      logger.info(`Current wallpaper: ${currentPath}`);
      return currentPath;
    } catch (error) {
      logger.error('Failed to get current wallpaper', error as Error);
      return '';
    }
  }
}

export const wallpaperSetter = new WallpaperSetter();
