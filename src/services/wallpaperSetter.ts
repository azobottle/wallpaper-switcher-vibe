import { exec } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Wallpaper setter class - 使用 Windows 原生 API
 * 完全移除 wallpaper npm 包依赖
 */
export class WallpaperSetter {
  /**
   * 设置 Windows 壁纸（使用 PowerShell + 注册表 + SystemParametersInfo API）
   * @param imagePath - 图片的绝对路径
   * @param options - 可选参数（保持 API 兼容性，当前未使用）
   */
  async setWallpaper(imagePath: string, options?: { scale?: string }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Setting wallpaper: ${imagePath}`);

        // 1. 解析绝对路径（Windows 风格路径）
        const fullPath = path.resolve(imagePath);

        // 2. 构造单行 PowerShell 命令
        // - 第一步：修改注册表 Wallpaper 项
        // - 第二步：调用 SystemParametersInfo 强制刷新
        const command = `powershell -ExecutionPolicy Bypass -Command "`
          + `$path = '${fullPath}'; `
          + `Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -Value $path; `
          + `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class W { [DllImport(\\"user32.dll\\")] public static extern int SystemParametersInfo(int a, int b, string c, int d); }'; `
          + `[W]::SystemParametersInfo(20, 0, $path, 3)`
          + `"`;

        // 3. 执行命令，使用 UTF-8 编码避免乱码
        exec(
          command,
          { encoding: 'utf8', env: { ...process.env, CHCP: '65001' } },
          (error, stdout, stderr) => {
            if (error) {
              logger.error(`Failed to set wallpaper: ${error.message}`);
              logger.error(`stderr: ${stderr}`);
              reject(error);
            } else {
              logger.info('Wallpaper set successfully');
              resolve(true);
            }
          }
        );
      } catch (error) {
        logger.error('Failed to set wallpaper', error as Error);
        resolve(false);
      }
    });
  }

  /**
   * 获取当前壁纸路径（从注册表读取）
   */
  async getCurrentWallpaper(): Promise<string> {
    try {
      const psCommand = `
        Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "Wallpaper" |
        Select-Object -ExpandProperty Wallpaper
      `;

      const result = await new Promise<string>((resolve, reject) => {
        exec(`powershell -command "${psCommand.replace(/\n/g, '')}"`, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        });
      });

      logger.info(`Current wallpaper: ${result}`);
      return result;
    } catch (error) {
      logger.error('Failed to get current wallpaper', error as Error);
      return '';
    }
  }
}

export const wallpaperSetter = new WallpaperSetter();
