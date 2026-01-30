export class Platform {
  /**
   * Check if running on Windows
   */
  static isWindows(): boolean {
    return process.platform === 'win32';
  }

  /**
   * Check if running on Linux
   */
  static isLinux(): boolean {
    return process.platform === 'linux';
  }

  /**
   * Check if running on macOS
   */
  static isMac(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Get platform-specific path separator
   */
  static pathSeparator(): string {
    return Platform.isWindows() ? ';' : ':';
  }

  /**
   * Get platform-specific executable extension
   */
  static exeExtension(): string {
    return Platform.isWindows() ? '.exe' : '';
  }

  /**
   * Get platform-specific batch file extension
   */
  static batExtension(): string {
    return Platform.isWindows() ? '.bat' : '.sh';
  }

  /**
   * Normalize path for platform
   */
  static normalizePath(p: string): string {
    if (Platform.isWindows()) {
      return p.replace(/\//g, '\\');
    } else {
      return p.replace(/\\/g, '/');
    }
  }
}