import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { EngineInstallation, EngineVersionInfo, EngineAssociation, EngineDetectionResult } from '../types/engine';
import { Platform } from '../utils/platform';

export class EngineResolver {
  /**
   * Resolve engine information for a project
   */
  static async resolveEngine(projectPath?: string): Promise<EngineDetectionResult> {
    const warnings: string[] = [];

    try {
      // If project path is provided, get engine association from .uproject
      let uprojectEngine: EngineAssociation | undefined;
      if (projectPath) {
        const uprojectResult = await this.getEngineAssociationFromProject(projectPath);
        if (uprojectResult.association) {
          uprojectEngine = uprojectResult.association;
        }
        warnings.push(...uprojectResult.warnings);
      }

      // Try to find engine installation
      const engineInstallations = await this.findEngineInstallations();

      // If we have an engine association, try to match it
      let matchedEngine: EngineInstallation | undefined;
      if (uprojectEngine && engineInstallations.length > 0) {
        matchedEngine = engineInstallations.find(
          engine => engine.associationId === uprojectEngine!.guid
        );

        if (!matchedEngine && uprojectEngine.guid) {
          warnings.push(`Engine with association ID ${uprojectEngine.guid} not found in installed engines`);
        }
      }

      // If no matched engine, use the first available engine or latest version
      if (!matchedEngine && engineInstallations.length > 0) {
        // Sort by version (newest first) and use the first one
        engineInstallations.sort((a, b) => this.compareVersions(b.version, a.version));
        matchedEngine = engineInstallations[0];
        warnings.push(`Using engine ${matchedEngine.displayName || matchedEngine.associationId} (not associated with project)`);
      }

      return {
        engine: matchedEngine,
        uprojectEngine,
        warnings
      };

    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        warnings
      };
    }
  }

  /**
   * Get engine association from .uproject file
   */
  private static async getEngineAssociationFromProject(projectPath: string): Promise<{
    association?: EngineAssociation;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // Check if projectPath is a directory or .uproject file
      let uprojectPath = projectPath;
      if (await fs.pathExists(projectPath) && (await fs.stat(projectPath)).isDirectory()) {
        // Look for .uproject file in directory
        const uprojectFiles = await fs.readdir(projectPath).then(files =>
          files.filter(f => f.endsWith('.uproject'))
        );

        if (uprojectFiles.length === 0) {
          warnings.push('No .uproject file found in project directory');
          return { warnings };
        }

        uprojectPath = path.join(projectPath, uprojectFiles[0]);
      }

      if (!uprojectPath.endsWith('.uproject')) {
        warnings.push('Project path is not a .uproject file');
        return { warnings };
      }

      // Read and parse .uproject file
      const content = await fs.readFile(uprojectPath, 'utf-8');
      const uproject = JSON.parse(content);

      if (!uproject.EngineAssociation) {
        warnings.push('No EngineAssociation found in .uproject file');
        return { warnings };
      }

      const association: EngineAssociation = {
        guid: uproject.EngineAssociation,
        name: uproject.EngineAssociation
      };

      return { association, warnings };

    } catch (error) {
      warnings.push(`Failed to read project file: ${error instanceof Error ? error.message : String(error)}`);
      return { warnings };
    }
  }

  /**
   * Find all Unreal Engine installations
   */
  public static async findEngineInstallations(): Promise<EngineInstallation[]> {
    const installations: EngineInstallation[] = [];

    // Platform-specific engine discovery
    if (Platform.isWindows()) {
      // Try registry first
      const registryEngines = await this.getEnginesFromRegistry();
      installations.push(...registryEngines);

      // Try launcher installed manifest
      const launcherEngines = await this.getEnginesFromLauncher();
      installations.push(...launcherEngines);
    }

    // Try environment variable
    const envEngine = await this.getEngineFromEnvironment();
    if (envEngine) {
      installations.push(envEngine);
    }

    // Remove duplicates (same path)
    const uniqueInstallations = this.removeDuplicateEngines(installations);

    // Load version info for each engine
    for (const installation of uniqueInstallations) {
      await this.loadEngineVersionInfo(installation);
    }

    return uniqueInstallations;
  }

  /**
   * Get engines from Windows registry
   */
  private static async getEnginesFromRegistry(): Promise<EngineInstallation[]> {
    const installations: EngineInstallation[] = [];

    try {
      // Query registry for UE builds
      // HKEY_CURRENT_USER\SOFTWARE\Epic Games\Unreal Engine\Builds
      const { stdout } = await execa('reg', [
        'query',
        'HKEY_CURRENT_USER\\SOFTWARE\\Epic Games\\Unreal Engine\\Builds',
        '/s'
      ]);

      // Parse registry output
      // Format:
      // HKEY_CURRENT_USER\SOFTWARE\Epic Games\Unreal Engine\Builds
      //    <GUID>    REG_SZ    <EnginePath>
      const lines = stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Try to match the complete pattern: {GUID}    REG_SZ    <EnginePath>
        // Some registry outputs have GUID and REG_SZ on the same line
        const fullMatch = trimmed.match(/{([^}]+)}\s+REG_SZ\s+(.+)$/);
        if (fullMatch) {
          const guid = `{${fullMatch[1]}}`;
          const enginePath = fullMatch[2].trim();

          installations.push({
            path: enginePath,
            associationId: guid,
            displayName: `UE Engine ${guid}`,
            version: undefined
          });
          continue;
        }

        // Fallback: Check for GUID line (starts with {) - for multi-line format
        if (trimmed.startsWith('{')) {
          const guidMatch = trimmed.match(/^({[^}]+})/);
          if (guidMatch) {
            const guid = guidMatch[1];

            // Check if this line also contains REG_SZ (some formats)
            const regSzMatch = trimmed.match(/REG_SZ\s+(.+)$/);
            if (regSzMatch) {
              const enginePath = regSzMatch[1].trim();
              installations.push({
                path: enginePath,
                associationId: guid,
                displayName: `UE Engine ${guid}`,
                version: undefined
              });
            }
          }
        }
      }
    } catch (error) {
      // Registry query may fail if no engines installed or permissions issue
      console.debug('Failed to query registry for UE engines:', error);
    }

    return installations;
  }

  /**
   * Get engines from Epic Games Launcher installation manifest
   */
  private static async getEnginesFromLauncher(): Promise<EngineInstallation[]> {
    const installations: EngineInstallation[] = [];

    try {
      // Common launcher manifest locations
      const manifestPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'UnrealEngine', 'Common', 'LauncherInstalled.dat'),
        path.join(process.env.PROGRAMDATA || '', 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat')
      ];

      for (const manifestPath of manifestPaths) {
        if (await fs.pathExists(manifestPath)) {
          try {
            const content = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(content);

            if (manifest.InstallationList && Array.isArray(manifest.InstallationList)) {
              for (const installation of manifest.InstallationList) {
                if (installation.AppName === 'UE_4' || installation.AppName === 'UE_5') {
                  installations.push({
                    path: installation.InstallLocation,
                    associationId: installation.AppName,
                    displayName: installation.DisplayName || `UE ${installation.AppVersion}`,
                    installedDate: installation.InstallDate,
                    version: undefined
                  });
                }
              }
            }
          } catch (parseError) {
            console.debug('Failed to parse launcher manifest:', parseError);
          }
        }
      }
    } catch (error) {
      console.debug('Failed to read launcher manifest:', error);
    }

    return installations;
  }

  /**
   * Get engine from environment variable
   */
  private static async getEngineFromEnvironment(): Promise<EngineInstallation | undefined> {
    const envVars = ['UE_ENGINE_PATH', 'UE_ROOT', 'UNREAL_ENGINE_PATH'];

    for (const envVar of envVars) {
      const enginePath = process.env[envVar];
      if (enginePath && await fs.pathExists(enginePath)) {
        return {
          path: enginePath,
          associationId: `ENV_${envVar}`,
          displayName: `UE Engine (from ${envVar})`,
          version: undefined
        };
      }
    }

    return undefined;
  }

  /**
   * Load version information for an engine installation
   */
  private static async loadEngineVersionInfo(installation: EngineInstallation): Promise<void> {
    try {
      // Look for version file in common locations
      const versionFilePaths = [
        path.join(installation.path, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.version'),
        path.join(installation.path, 'Engine', 'Build', 'Build.version')
      ];

      for (const versionFilePath of versionFilePaths) {
        if (await fs.pathExists(versionFilePath)) {
          try {
            const content = await fs.readFile(versionFilePath, 'utf-8');
            const versionInfo: EngineVersionInfo = JSON.parse(content);
            installation.version = versionInfo;

            // Generate better display name
            installation.displayName = `UE ${versionInfo.MajorVersion}.${versionInfo.MinorVersion}.${versionInfo.PatchVersion}`;

            return;
          } catch (parseError) {
            console.debug('Failed to parse version file:', parseError);
          }
        }
      }

      // If no version file found, try to extract version from path
      const pathMatch = installation.path.match(/UE_(?:5|4)[._]?(\d+(?:[._]\d+)*)/i);
      if (pathMatch) {
        const versionStr = pathMatch[1].replace('_', '.');
        installation.version = {
          MajorVersion: parseInt(versionStr.split('.')[0]) || 5,
          MinorVersion: parseInt(versionStr.split('.')[1]) || 0,
          PatchVersion: parseInt(versionStr.split('.')[2]) || 0,
          Changelist: 0,
          CompatibleChangelist: 0,
          IsLicenseeVersion: 0,
          IsPromotedBuild: 0,
          BranchName: '',
          BuildId: ''
        };
        installation.displayName = `UE ${versionStr}`;
      }
    } catch (error) {
      console.debug('Failed to load engine version info:', error);
    }
  }

  /**
   * Remove duplicate engines (same path)
   */
  private static removeDuplicateEngines(installations: EngineInstallation[]): EngineInstallation[] {
    const seen = new Set<string>();
    const unique: EngineInstallation[] = [];

    for (const installation of installations) {
      const normalizedPath = path.normalize(installation.path).toLowerCase();
      if (!seen.has(normalizedPath)) {
        seen.add(normalizedPath);
        unique.push(installation);
      }
    }

    return unique;
  }

  /**
   * Compare two engine versions (semantic version comparison)
   */
  private static compareVersions(a?: EngineVersionInfo, b?: EngineVersionInfo): number {
    // Handle undefined versions
    if (!a && !b) return 0;
    if (!a) return -1; // a is undefined, b is defined -> a < b
    if (!b) return 1;  // a is defined, b is undefined -> a > b

    if (a.MajorVersion !== b.MajorVersion) {
      return a.MajorVersion - b.MajorVersion;
    }
    if (a.MinorVersion !== b.MinorVersion) {
      return a.MinorVersion - b.MinorVersion;
    }
    if (a.PatchVersion !== b.PatchVersion) {
      return a.PatchVersion - b.PatchVersion;
    }
    return a.Changelist - b.Changelist;
  }
}