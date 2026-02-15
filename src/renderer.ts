import './index.css';

// Extend Window interface for our electronAPI
declare global {
  interface Window {
    electronAPI: {
      downloadNow: () => Promise<boolean>;
      getHistory: () => Promise<any[]>;
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<{ success: boolean }>;
      onDownloadComplete: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

class WallpaperApp {
  private refreshBtn: HTMLElement;
  private settingsToggleBtn: HTMLElement;
  private settingsPanel: HTMLElement;
  private currentWallpaperInfo: HTMLElement;
  private historyList: HTMLElement;
  private regionSelect: HTMLSelectElement;
  private showNotifications: HTMLInputElement;
  private autoStart: HTMLInputElement;
  private scheduleTimesDiv: HTMLElement;
  private saveSettingsBtn: HTMLElement;
  private cancelSettingsBtn: HTMLElement;
  private addScheduleBtn: HTMLElement;

  private currentConfig: any = null;

  constructor() {
    // Get DOM elements
    this.refreshBtn = document.getElementById('refresh-btn')!;
    this.settingsToggleBtn = document.getElementById('settings-toggle-btn')!;
    this.settingsPanel = document.getElementById('settings-panel')!;
    this.currentWallpaperInfo = document.getElementById('current-wallpaper-info')!;
    this.historyList = document.getElementById('history-list')!;
    this.regionSelect = document.getElementById('region-select') as HTMLSelectElement;
    this.showNotifications = document.getElementById('show-notifications') as HTMLInputElement;
    this.autoStart = document.getElementById('auto-start') as HTMLInputElement;
    this.scheduleTimesDiv = document.getElementById('schedule-times')!;
    this.saveSettingsBtn = document.getElementById('save-settings-btn')!;
    this.cancelSettingsBtn = document.getElementById('cancel-settings-btn')!;
    this.addScheduleBtn = document.getElementById('add-schedule-btn')!;

    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.loadConfig();
    await this.loadHistory();
  }

  private setupEventListeners() {
    this.refreshBtn.addEventListener('click', () => this.handleRefresh());
    this.settingsToggleBtn.addEventListener('click', () => this.toggleSettings());
    this.cancelSettingsBtn.addEventListener('click', () => this.toggleSettings());
    this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    this.addScheduleBtn.addEventListener('click', () => this.addScheduleTime());
  }

  private async loadConfig() {
    try {
      this.currentConfig = await window.electronAPI.getConfig();

      // Populate settings form
      this.regionSelect.value = this.currentConfig.region;
      this.showNotifications.checked = this.currentConfig.showNotifications;
      this.autoStart.checked = this.currentConfig.autoStart;

      // Populate schedule times
      this.scheduleTimesDiv.innerHTML = '';
      this.currentConfig.scheduleTimes.forEach((time: string) => {
        this.addScheduleTimeElement(time);
      });
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showError('Failed to load configuration');
    }
  }

  private async loadHistory() {
    try {
      const history = await window.electronAPI.getHistory();

      if (history.length === 0) {
        this.historyList.innerHTML = '<p>No wallpapers downloaded yet.</p>';
        this.currentWallpaperInfo.innerHTML = '<p>No wallpaper set yet.</p>';
        return;
      }

      // Display current wallpaper (first item)
      const current = history[0];
      this.currentWallpaperInfo.innerHTML = `
        <div class="wallpaper-item">
          <p><strong>Date:</strong> ${current.date}</p>
          <p><strong>Description:</strong> ${current.copyright}</p>
          <p><strong>Region:</strong> ${current.region}</p>
        </div>
      `;

      // Display history (last 7 days)
      const recentHistory = history.slice(0, 7);
      this.historyList.innerHTML = recentHistory
        .map(
          (item: any) => `
        <div class="wallpaper-item">
          <p><strong>${item.date}</strong></p>
          <p>${item.copyright}</p>
          <p class="region-tag">${item.region}</p>
        </div>
      `
        )
        .join('');
    } catch (error) {
      console.error('Failed to load history:', error);
      this.showError('Failed to load wallpaper history');
    }
  }

  private async handleRefresh() {
    const refreshBtn = this.refreshBtn as HTMLButtonElement;
    const originalText = refreshBtn.textContent;
    refreshBtn.textContent = 'Refreshing...';
    refreshBtn.disabled = true;

    try {
      const success = await window.electronAPI.downloadNow();

      if (success) {
        await this.loadHistory();
        this.showSuccess('Wallpaper refreshed successfully!');
      } else {
        this.showError('Failed to refresh wallpaper');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      this.showError('Failed to refresh wallpaper');
    } finally {
      refreshBtn.textContent = originalText;
      refreshBtn.disabled = false;
    }
  }

  private toggleSettings() {
    this.settingsPanel.classList.toggle('hidden');
  }

  private addScheduleTimeElement(time: string = '08:00') {
    const timeDiv = document.createElement('div');
    timeDiv.className = 'schedule-time-item';

    const input = document.createElement('input');
    input.type = 'time';
    input.value = time;
    input.className = 'schedule-time-input';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'remove-time-btn';
    removeBtn.onclick = () => timeDiv.remove();

    timeDiv.appendChild(input);
    timeDiv.appendChild(removeBtn);
    this.scheduleTimesDiv.appendChild(timeDiv);
  }

  private addScheduleTime() {
    this.addScheduleTimeElement('00:00');
  }

  private async handleSaveSettings() {
    try {
      // Collect schedule times from inputs
      const scheduleInputs = this.scheduleTimesDiv.querySelectorAll('.schedule-time-input');
      const scheduleTimes = Array.from(scheduleInputs).map(
        (input) => (input as HTMLInputElement).value
      );

      // Validate times
      const validTimes = scheduleTimes.filter((time) => time && time.match(/^\d{2}:\d{2}$/));

      if (validTimes.length === 0) {
        this.showError('Please add at least one schedule time');
        return;
      }

      const newConfig = {
        region: this.regionSelect.value,
        scheduleTimes: validTimes.sort(),
        showNotifications: this.showNotifications.checked,
        autoStart: this.autoStart.checked
      };

      await window.electronAPI.updateConfig(newConfig);
      this.currentConfig = newConfig;

      this.showSuccess('Settings saved successfully!');
      this.toggleSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError('Failed to save settings');
    }
  }

  private showSuccess(message: string) {
    // Simple alert for now, could be enhanced with proper notifications
    console.log('Success:', message);
  }

  private showError(message: string) {
    console.error('Error:', message);
    alert(message);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new WallpaperApp();
});

console.log('Bing Wallpaper Switcher loaded');
