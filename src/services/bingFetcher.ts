import https from 'https';
import { URL } from 'url';
import { BingImage, BingApiResponse } from '../types';
import { BING_API_TEMPLATE, BING_BASE_URL, USER_AGENT } from '../constants/app';
import { logger } from '../utils/logger';

export class BingFetcher {
  /**
   * Fetch latest Bing wallpaper information
   */
  async fetchLatestImage(region: string): Promise<BingImage> {
    return new Promise((resolve, reject) => {
      const apiUrl = BING_API_TEMPLATE.replace('%s', region);

      logger.info(`Fetching Bing wallpaper info from region: ${region}`);

      const options = {
        headers: {
          'User-Agent': USER_AGENT
        }
      };

      https.get(apiUrl, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response: BingApiResponse = JSON.parse(data);

            if (!response.images || response.images.length === 0) {
              throw new Error('No images found in Bing API response');
            }

            const imageData = response.images[0];

            // Construct full image URL
            const fullUrl = BING_BASE_URL + imageData.url;

            const bingImage: BingImage = {
              url: fullUrl,
              enddate: imageData.enddate,
              copyright: imageData.copyright
            };

            logger.info(`Successfully fetched Bing image: ${imageData.enddate}`);
            resolve(bingImage);
          } catch (error) {
            logger.error('Failed to parse Bing API response', error as Error);
            reject(error);
          }
        });
      }).on('error', (error) => {
        logger.error('Failed to fetch Bing API', error);
        reject(error);
      });
    });
  }

  /**
   * Download image from URL to local file
   */
  async downloadImage(imageUrl: string, savePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Downloading image from: ${imageUrl}`);

      const options = {
        headers: {
          'User-Agent': USER_AGENT
        }
      };

      const file = require('fs').createWriteStream(savePath);

      https.get(imageUrl, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download image. Status code: ${res.statusCode}`));
          return;
        }

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          logger.info(`Image saved to: ${savePath}`);
          resolve();
        });

        file.on('error', (err) => {
          require('fs').unlink(savePath, () => {}); // Delete the file
          logger.error('Error writing image file', err);
          reject(err);
        });
      }).on('error', (error) => {
        logger.error('Failed to download image', error);
        reject(error);
      });
    });
  }
}

export const bingFetcher = new BingFetcher();
