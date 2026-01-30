import path from 'path';
import fs from 'fs-extra';

export class Validator {
  /**
   * Validate project name (alphanumeric, underscores, hyphens)
   */
  static isValidProjectName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Validate engine path
   */
  static async isValidEnginePath(enginePath: string): Promise<boolean> {
    try {
      const normalizedPath = path.normalize(enginePath);

      // Check if path exists
      if (!(await fs.pathExists(normalizedPath))) {
        return false;
      }

      // Check for common engine directories
      const requiredDirs = [
        path.join(normalizedPath, 'Engine'),
        path.join(normalizedPath, 'Engine', 'Binaries')
      ];

      for (const dir of requiredDirs) {
        if (!(await fs.pathExists(dir))) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate build target
   */
  static isValidBuildTarget(target: string): boolean {
    const validTargets = ['Editor', 'Game', 'Client', 'Server'];
    // Accept generic targets or any non-empty string (specific project target names)
    return validTargets.includes(target) || target.trim().length > 0;
  }

  /**
   * Validate build configuration
   */
  static isValidBuildConfig(config: string): boolean {
    const validConfigs = ['Debug', 'DebugGame', 'Development', 'Shipping', 'Test'];
    return validConfigs.includes(config);
  }

  /**
   * Validate build platform
   */
  static isValidBuildPlatform(platform: string): boolean {
    const validPlatforms = ['Win64', 'Win32', 'Linux', 'Mac', 'Android', 'IOS'];
    return validPlatforms.includes(platform);
  }

  /**
   * Validate IDE type
   */
  static isValidIDE(ide: string): boolean {
    const validIDEs = ['sln', 'vscode', 'clion', 'xcode', 'vs2022'];
    return validIDEs.includes(ide);
  }

  /**
   * Validate project type
   */
  static isValidProjectType(type: string): boolean {
    const validTypes = ['cpp', 'blueprint', 'blank'];
    return validTypes.includes(type);
  }

  /**
   * Validate .uproject file
   */
  static async isValidUProjectFile(uprojectPath: string): Promise<boolean> {
    try {
      if (!uprojectPath.endsWith('.uproject')) {
        return false;
      }

      if (!(await fs.pathExists(uprojectPath))) {
        return false;
      }

      const content = await fs.readFile(uprojectPath, 'utf-8');
      const uproject = JSON.parse(content);

      // Basic validation
      return uproject.FileVersion === 3 && uproject.EngineAssociation && Array.isArray(uproject.Modules);
    } catch {
      return false;
    }
  }

  /**
   * Validate directory is safe for project initialization
   */
  static async isSafeForInit(directory: string, force = false): Promise<{ safe: boolean; message: string }> {
    try {
      if (!(await fs.pathExists(directory))) {
        return { safe: true, message: 'Directory does not exist, will be created' };
      }

      const stat = await fs.stat(directory);
      if (!stat.isDirectory()) {
        return { safe: false, message: 'Path exists but is not a directory' };
      }

      // Check if directory is empty
      const files = await fs.readdir(directory);
      const filteredFiles = files.filter(f => !f.startsWith('.') && f !== '.git');

      if (filteredFiles.length === 0) {
        return { safe: true, message: 'Directory is empty or contains only hidden files' };
      }

      // Check for existing UE project
      const uprojectFiles = files.filter(f => f.endsWith('.uproject'));
      if (uprojectFiles.length > 0) {
        return {
          safe: false,
          message: `Directory already contains Unreal Engine project: ${uprojectFiles[0]}`
        };
      }

      // If force flag is set, allow non-empty directory
      if (force) {
        return {
          safe: true,
          message: 'Directory is not empty, but force flag is set - proceeding anyway'
        };
      }

      return {
        safe: false,
        message: 'Directory is not empty. Use --force to override.'
      };
    } catch (error) {
      return {
        safe: false,
        message: `Failed to check directory: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}