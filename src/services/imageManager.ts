import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { BingImage, WallpaperHistory } from '../types';
import { logger } from '../utils/logger';

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

    // Keep only last 30 records
    if (this.history.length > 30) {
      this.history = this.history.slice(0, 30);
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
}

export const imageManager = new ImageManager();
