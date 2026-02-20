import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { BingImage, WallpaperHistory } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/config';

class ImageManager {
  private wallpapersDir: string | null = null;
  private historyFilePath: string | null = null;
  private history: WallpaperHistory[] = [];
  private initialized = false;
  private historyLoaded = false;

  private getWallpapersDir(): string {
    if (!this.wallpapersDir) {
      const userDataPath = app.getPath('userData');
      this.wallpapersDir = path.join(userDataPath, 'wallpapers');
    }
    return this.wallpapersDir;
  }

  private getHistoryFilePath(): string {
    if (!this.historyFilePath) {
      const userDataPath = app.getPath('userData');
      this.historyFilePath = path.join(userDataPath, 'history.json');
    }
    return this.historyFilePath;
  }

  private initializeDirectories(): void {
    if (this.initialized) return;

    const wallpapersDir = this.getWallpapersDir();
    if (!fs.existsSync(wallpapersDir)) {
      fs.mkdirSync(wallpapersDir, { recursive: true });
      logger.info(`Created wallpapers directory: ${wallpapersDir}`);
    }
    this.initialized = true;
  }

  private loadHistory(): void {
    if (this.historyLoaded) return;  // Avoid duplicate loading

    try {
      const historyPath = this.getHistoryFilePath();
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf-8');
        this.history = JSON.parse(data);
        logger.info(`Loaded ${this.history.length} wallpaper history records`);
      }
    } catch (error) {
      logger.error('Failed to load wallpaper history', error as Error);
      this.history = [];
    } finally {
      this.historyLoaded = true;
    }
  }

  private ensureHistoryLoaded(): void {
    if (!this.historyLoaded) {
      this.loadHistory();
    }
  }

  private saveHistory(): void {
    try {
      const historyPath = this.getHistoryFilePath();
      fs.writeFileSync(historyPath, JSON.stringify(this.history, null, 2));
    } catch (error) {
      logger.error('Failed to save wallpaper history', error as Error);
    }
  }

  /**
   * Check if wallpaper already exists for a given date
   */
  exists(enddate: string): boolean {
    this.ensureHistoryLoaded();
    return this.history.some(record => record.date === enddate);
  }

  /**
   * Get local path for a wallpaper by date
   */
  getWallpaperPath(enddate: string): string | null {
    this.ensureHistoryLoaded();
    const record = this.history.find(r => r.date === enddate);
    return record ? record.localPath : null;
  }

  /**
   * Download and save wallpaper
   */
  async downloadWallpaper(bingImage: BingImage, downloadFn: (url: string, path: string) => Promise<void>): Promise<string> {
    this.initializeDirectories();
    const filename = `${bingImage.enddate}.jpg`;
    const localPath = path.join(this.getWallpapersDir(), filename);

    if (fs.existsSync(localPath)) {
      logger.info(`Wallpaper already exists locally: ${localPath}`);
      return localPath;
    }

    await downloadFn(bingImage.url, localPath);
    return localPath;
  }

  /**
   * Save wallpaper metadata to history
   */
  saveImageMetadata(bingImage: BingImage, localPath: string, region: string): void {
    this.ensureHistoryLoaded();
    const record: WallpaperHistory = {
      date: bingImage.enddate,
      localPath: localPath,
      copyright: bingImage.copyright,
      url: bingImage.url,
      region: region
    };

    // Remove existing record for same date if exists
    this.history = this.history.filter(r => r.date !== bingImage.enddate);

    // Add new record at the beginning
    this.history.unshift(record);

    // Keep only last N records (from config)
    const maxCount = configManager.get('maxHistoryCount');
    if (this.history.length > maxCount) {
      this.history = this.history.slice(0, maxCount);
    }

    this.saveHistory();
    logger.info(`Saved wallpaper metadata for date: ${bingImage.enddate}`);
  }

  /**
   * Get wallpaper history
   */
  getHistory(): WallpaperHistory[] {
    this.ensureHistoryLoaded();
    return [...this.history];
  }

  /**
   * Get the latest wallpaper
   */
  getLatestWallpaper(): WallpaperHistory | null {
    this.ensureHistoryLoaded();
    return this.history.length > 0 ? this.history[0] : null;
  }

  /**
   * Clean up old history records to keep only the latest N records
   */
  cleanupOldHistory(maxCount: number): void {
    this.ensureHistoryLoaded();

    const originalLength = this.history.length;
    logger.info(`cleanupOldHistory called: maxCount=${maxCount}, current history length=${originalLength}`);

    if (this.history.length > maxCount) {
      // Get records to delete (the oldest ones beyond maxCount)
      const recordsToDelete = this.history.slice(maxCount);
      logger.info(`Records to delete: ${recordsToDelete.length}, dates: ${recordsToDelete.map(r => r.date).join(', ')}`);

      // Delete the actual wallpaper files
      let deletedFiles = 0;
      let missingFiles = 0;
      recordsToDelete.forEach(record => {
        logger.info(`Checking file: ${record.localPath}, exists: ${fs.existsSync(record.localPath)}`);
        try {
          if (fs.existsSync(record.localPath)) {
            fs.unlinkSync(record.localPath);
            deletedFiles++;
            logger.info(`Deleted old wallpaper file: ${record.localPath}`);
          } else {
            missingFiles++;
            logger.warn(`Wallpaper file not found: ${record.localPath}`);
          }
        } catch (error) {
          logger.error(`Failed to delete wallpaper file: ${record.localPath}`, error as Error);
        }
      });

      // Now update history array
      this.history = this.history.slice(0, maxCount);
      this.saveHistory();

      logger.info(`Cleaned up ${originalLength - this.history.length} old history records, ${deletedFiles} files deleted, ${missingFiles} files not found`);
    } else {
      logger.info(`No cleanup needed: history length (${this.history.length}) <= maxCount (${maxCount})`);
    }

    // Also clean up orphaned files (files in wallpapers dir but not in history)
    this.cleanupOrphanedFiles();
  }

  /**
   * Clean up orphaned wallpaper files that exist on disk but not in history
   */
  private cleanupOrphanedFiles(): void {
    try {
      const wallpapersDir = this.getWallpapersDir();
      if (!fs.existsSync(wallpapersDir)) {
        return;
      }

      // Get all files in wallpapers directory
      const allFiles = fs.readdirSync(wallpapersDir).filter(f => f.endsWith('.jpg'));
      logger.info(`Found ${allFiles.length} wallpaper files in directory`);

      // Get set of files that are in history
      const filesInHistory = new Set(this.history.map(r => path.basename(r.localPath)));
      logger.info(`Files in history: ${filesInHistory.size}`);

      // Find orphaned files
      const orphanedFiles = allFiles.filter(f => !filesInHistory.has(f));
      logger.info(`Found ${orphanedFiles.length} orphaned files: ${orphanedFiles.join(', ')}`);

      // Delete orphaned files
      let deletedCount = 0;
      orphanedFiles.forEach(file => {
        const filePath = path.join(wallpapersDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`Deleted orphaned wallpaper file: ${filePath}`);
        } catch (error) {
          logger.error(`Failed to delete orphaned file: ${filePath}`, error as Error);
        }
      });

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} orphaned wallpaper files`);
      }
    } catch (error) {
      logger.error('Failed to cleanup orphaned files', error as Error);
    }
  }
}

export const imageManager = new ImageManager();
