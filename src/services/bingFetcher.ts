import { net } from 'electron';
import fs from 'node:fs/promises';
import { BingImage, BingApiResponse } from '../types';
import { BING_API_TEMPLATE, BING_BASE_URL, USER_AGENT } from '../constants/app';
import { logger } from '../utils/logger';

const REQUEST_TIMEOUT_MS = 30_000;

export class BingFetcher {
  /**
   * Uses Electron's Chromium network stack, which follows Windows' certificate
   * trust store and system proxy settings on corporate networks.
   */
  private async fetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await net.fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Request failed with HTTP ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Request to ${new URL(url).hostname} failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Fetch latest Bing wallpaper information. */
  async fetchLatestImage(region: string): Promise<BingImage> {
    const apiUrl = BING_API_TEMPLATE.replace('%s', region);
    logger.info(`Fetching Bing wallpaper info from region: ${region}`);

    try {
      const response = await this.fetch(apiUrl);
      const data: BingApiResponse = await response.json();

      if (!data.images || data.images.length === 0) {
        throw new Error('No images found in Bing API response');
      }

      const imageData = data.images[0];
      const bingImage: BingImage = {
        url: new URL(imageData.url, BING_BASE_URL).toString(),
        enddate: imageData.enddate,
        copyright: imageData.copyright
      };

      logger.info(`Successfully fetched Bing image: ${imageData.enddate}`);
      return bingImage;
    } catch (error) {
      logger.error('Failed to fetch Bing API', error as Error);
      throw error;
    }
  }

  /** Download an image using the same Windows-aware network stack. */
  async downloadImage(imageUrl: string, savePath: string): Promise<void> {
    logger.info(`Downloading image from: ${imageUrl}`);
    const temporaryPath = `${savePath}.download`;

    try {
      const response = await this.fetch(imageUrl);
      const image = Buffer.from(await response.arrayBuffer());

      if (image.length === 0) {
        throw new Error('Downloaded image is empty');
      }

      await fs.writeFile(temporaryPath, image);
      await fs.rename(temporaryPath, savePath);
      logger.info(`Image saved to: ${savePath}`);
    } catch (error) {
      await fs.unlink(temporaryPath).catch(() => undefined);
      logger.error('Failed to download image', error as Error);
      throw error;
    }
  }
}

export const bingFetcher = new BingFetcher();
