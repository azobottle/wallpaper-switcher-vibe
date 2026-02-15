export interface BingImage {
  url: string;
  enddate: string;
  copyright: string;
  startdate?: string;
  fullstartdate?: string;
  urlbase?: string;
  copyrightlink?: string;
  title?: string;
  quiz?: string;
  wp?: boolean;
  hsh?: string;
  drk?: number;
  top?: number;
  bot?: number;
  hs?: any[];
}

export interface BingApiResponse {
  images: BingImage[];
  tooltip?: string;
}

export interface WallpaperHistory {
  date: string;
  localPath: string;
  copyright: string;
  url: string;
  region: string;
}

export interface AppConfig {
  scheduleTimes: string[];
  region: string;
  autoStart: boolean;
  showNotifications: boolean;
}
