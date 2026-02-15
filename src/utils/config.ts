import { app } from 'electron';
import { AppConfig } from '../types';
import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG: AppConfig = {
  scheduleTimes: ['08:00', '16:00', '00:00'],
  region: 'en-US',
  autoStart: true,
  showNotifications: true
};

class ConfigManager {
  private config: AppConfig;

  constructor() {
    // Don't load config in constructor to avoid early crash
    // Defer loading until first access
  }

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'config.json');
  }

  private loadConfig(): void {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(data);
      } else {
        // Create default config if not exists
        this.config = { ...DEFAULT_CONFIG };
        this.saveConfig();
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig(): void {
    try {
      const configPath = this.getConfigPath();
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    this.loadConfig();
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.loadConfig();
    this.config[key] = value;
    this.saveConfig();
  }

  getAll(): AppConfig {
    this.loadConfig();
    return { ...this.config };
  }

  update(config: Partial<AppConfig>): void {
    this.loadConfig();
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }
}

// Export singleton instance
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

// Export singleton instance for easy importing
export const configManager = getConfigManager();
