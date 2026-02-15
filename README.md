# Bing Wallpaper Switcher

An Electron desktop application that automatically downloads and sets Bing's daily wallpaper as your desktop background.

## Features

- **Automatic Wallpaper Download**: Downloads the latest Bing wallpaper on startup
- **Scheduled Updates**: Automatically updates wallpaper at configurable times (default: 8:00, 16:00, 00:00)
- **Multiple Regions**: Supports different Bing regions (US, China, Japan, India, Brazil, France, Germany)
- **Wallpaper History**: Keeps track of downloaded wallpapers
- **System Tray**: Runs in the background with system tray icon
- **Customizable Schedule**: Configure when to update wallpapers
- **Notifications**: Optional desktop notifications on wallpaper update

## Development

```bash
# Install dependencies
npm install

# Start application in development mode
npm start

# Package the application (creates .exe on Windows)
npm package

# Create installers for all platforms
npm make
```

## Configuration

The application stores configuration in:
- **Windows**: `C:\Users\<username>\AppData\Roaming\wallpaper-switcher-vibe\config.json`
- **macOS**: `~/Library/Application Support/wallpaper-switcher-vibe/config.json`
- **Linux**: `~/.config/wallpaper-switcher-vibe/config.json`

Default configuration:
```json
{
  "scheduleTimes": ["08:00", "16:00", "00:00"],
  "region": "en-US",
  "autoStart": true,
  "showNotifications": true
}
```

## Wallpapers Storage

Downloaded wallpapers are stored in:
- **Windows**: `C:\Users\<username>\AppData\Roaming\wallpaper-switcher-vibe\wallpapers\`
- **macOS**: `~/Library/Application Support/wallpaper-switcher-vibe/wallpapers/`
- **Linux**: `~/.config/wallpaper-switcher-vibe/wallpapers/`

## Logs

Application logs are stored in:
- **Windows**: `C:\Users\<username>\AppData\Roaming\wallpaper-switcher-vibe\logs\app.log`
- **macOS**: `~/Library/Application Support/wallpaper-switcher-vibe/logs/app.log`
- **Linux**: `~/.config/wallpaper-switcher-vibe/logs/app.log`

## Usage

1. **Start the Application**: The app will automatically download and set the latest Bing wallpaper
2. **System Tray**: The app runs in the background and can be accessed from the system tray
3. **Manual Refresh**: Right-click the tray icon and select "Refresh Now" to download the latest wallpaper
4. **View History**: Select "View History" to see previously downloaded wallpapers
5. **Settings**: Configure region, schedule times, and notifications from the settings panel

## Supported Regions

- `en-US` - English (United States)
- `zh-CN` - Chinese (China)
- `ja-JP` - Japanese (Japan)
- `en-IN` - English (India)
- `pt-BR` - Portuguese (Brazil)
- `fr-FR` - French (France)
- `de-DE` - German (Germany)

## Architecture

The application follows Electron's three-process architecture:

- **Main Process**: Manages application lifecycle, downloads wallpapers, and handles scheduling
- **Preload Script**: Secure bridge between main and renderer processes
- **Renderer Process**: UI for configuration and wallpaper history

## Technologies

- **Electron**: Desktop application framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **node-cron**: Cron-style task scheduling
- **wallpaper**: Cross-platform wallpaper setting
- **electron-store**: Persistent configuration storage

## License

MIT
