import cron from 'node-cron';
import { logger } from '../utils/logger';
import { configManager } from '../utils/config';

type ScheduledCallback = () => Promise<void>;

type ScheduledTask = {
  stop: () => void;
  running: boolean;
};

class Scheduler {
  private jobs: ScheduledTask[] = [];
  private scheduledCallback: ScheduledCallback | null = null;
  private cleanupCallback: (() => void) | null = null;

  /**
   * Initialize scheduler with callback function
   */
  initialize(callback: ScheduledCallback, cleanupCallback?: () => void): void {
    this.scheduledCallback = callback;
    this.cleanupCallback = cleanupCallback || null;
    this.restartJobs();
  }

  /**
   * Convert time string (HH:MM) to cron pattern
   */
  private timeToCronPattern(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${minutes} ${hours} * * *`;
  }

  /**
   * Stop all current jobs
   */
  stopAllJobs(): void {
    this.jobs.forEach(job => {
      try {
        job.stop();
      } catch (error) {
        // Ignore errors when stopping jobs
      }
    });
    this.jobs = [];
    logger.info('All scheduled jobs stopped');
  }

  /**
   * Restart all jobs based on current configuration
   */
  restartJobs(): void {
    this.stopAllJobs();

    const scheduleTimes = configManager.get('scheduleTimes');

    scheduleTimes.forEach(time => {
      const cronPattern = this.timeToCronPattern(time);

      try {
        const task = cron.schedule(
          cronPattern,
          async () => {
            logger.info(`Scheduled task triggered at ${time}`);
            if (this.scheduledCallback) {
              try {
                await this.scheduledCallback();
              } catch (error) {
                logger.error(`Error in scheduled task at ${time}`, error as Error);
              }
            }
          },
          {
            scheduled: true
          }
        );

        this.jobs.push(task);
        logger.info(`Scheduled job created for time: ${time} (${cronPattern})`);
      } catch (error) {
        logger.error(`Failed to create job for time: ${time}`, error as Error);
      }
    });

    // Create daily cleanup job
    const cleanupTime = configManager.get('cleanupTime');
    if (cleanupTime) {
      const cleanupCronPattern = this.timeToCronPattern(cleanupTime);
      try {
        const cleanupTask = cron.schedule(
          cleanupCronPattern,
          () => {
            logger.info(`Daily cleanup task triggered at ${cleanupTime}`);
            if (this.cleanupCallback) {
              try {
                this.cleanupCallback();
              } catch (error) {
                logger.error(`Error in daily cleanup task`, error as Error);
              }
            }
          },
          {
            scheduled: true
          }
        );

        this.jobs.push(cleanupTask);
        logger.info(`Scheduled cleanup job created for time: ${cleanupTime} (${cleanupCronPattern})`);
      } catch (error) {
        logger.error(`Failed to create cleanup job`, error as Error);
      }
    }

    logger.info(`Scheduler initialized with ${this.jobs.length} jobs`);
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.jobs.length > 0;
  }

  /**
   * Get number of active jobs
   */
  getJobCount(): number {
    return this.jobs.length;
  }
}

export const scheduler = new Scheduler();
