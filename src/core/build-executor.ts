import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import { BuildOptions, BuildResult, BuildTarget, BuildConfiguration, BuildPlatform } from '../types/build';
import { Logger } from '../utils/logger';
import { Platform } from '../utils/platform';

export class BuildExecutor {
  /**
   * Execute Unreal Engine build
   */
  static async execute(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now();

    try {
      // Validate options
      const validatedOptions = await this.validateOptions(options);
      const { target, config, platform, projectPath, enginePath } = validatedOptions;

      Logger.info(`Starting build: ${target} | ${platform} | ${config}`);
      Logger.info(`Project: ${projectPath}`);
      Logger.info(`Engine: ${enginePath}`);

      // Check if Build.bat exists
      const buildBatPath = path.join(enginePath, 'Engine', 'Build', 'BatchFiles', 'Build.bat');
      const buildScriptExists = await fs.pathExists(buildBatPath);

      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      if (buildScriptExists) {
        // Use Build.bat
        const result = await this.executeBuildBat(buildBatPath, validatedOptions);
        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.exitCode;
      } else {
        // Fallback to UnrealBuildTool directly
        const result = await this.executeUnrealBuildTool(enginePath, validatedOptions);
        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.exitCode;
      }

      const duration = Date.now() - startTime;
      const success = exitCode === 0;

      const buildResult: BuildResult = {
        success,
        exitCode,
        stdout,
        stderr,
        duration
      };

      if (!success) {
        buildResult.error = `Build failed with exit code ${exitCode}`;
      }

      return buildResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        duration,
        error: 'Build execution failed'
      };
    }
  }

  /**
   * Validate and complete build options
   */
  private static async validateOptions(options: BuildOptions): Promise<Required<BuildOptions>> {
    const target: BuildTarget = options.target || 'Editor';
    const config: BuildConfiguration = options.config || 'Development';
    const platform: BuildPlatform = options.platform || 'Win64';
    const clean = options.clean || false;
    const verbose = options.verbose || false;
    const additionalArgs = options.additionalArgs || [];

    // Validate project path
    let projectPath = options.projectPath || process.cwd();
    if (await fs.pathExists(projectPath) && (await fs.stat(projectPath)).isDirectory()) {
      // Look for .uproject file
      const uprojectFiles = await fs.readdir(projectPath).then(files =>
        files.filter(f => f.endsWith('.uproject'))
      );

      if (uprojectFiles.length > 0) {
        projectPath = path.join(projectPath, uprojectFiles[0]);
      } else {
        throw new Error(`No .uproject file found in project directory: ${projectPath}`);
      }
    }

    // Validate engine path
    let enginePath = options.enginePath;
    if (!enginePath) {
      // Try to resolve engine path
      const { EngineResolver } = await import('./engine-resolver');
      const engineResult = await EngineResolver.resolveEngine(projectPath);
      if (!engineResult.engine) {
        throw new Error('Could not determine engine path. Please specify --engine-path');
      }
      enginePath = engineResult.engine.path;
    }

    // Validate engine path exists
    if (!(await fs.pathExists(enginePath))) {
      throw new Error(`Engine path does not exist: ${enginePath}`);
    }

    // Resolve target name from generic type to project-specific target
    let resolvedTarget = target;
    const availableTargets = await this.getAvailableTargets(projectPath);

    if (availableTargets.length > 0) {
      // Check if target is a generic type (Editor, Game, Client, Server)
      const genericTypes = ['Editor', 'Game', 'Client', 'Server'];
      const isGenericType = genericTypes.includes(target);

      if (isGenericType) {
        // Find a target matching the generic type
        const matchingTarget = availableTargets.find(t => t.type === target);
        if (matchingTarget) {
          resolvedTarget = matchingTarget.name;
          Logger.debug(`Resolved generic target "${target}" to "${resolvedTarget}"`);
        } else {
          // No matching target found, try to find any target with the type in name
          const fallbackTarget = availableTargets.find(t =>
            t.name.toLowerCase().includes(target.toLowerCase())
          );
          if (fallbackTarget) {
            resolvedTarget = fallbackTarget.name;
            Logger.debug(`Fallback: resolved target "${target}" to "${resolvedTarget}"`);
          } else {
            throw new Error(`No ${target} target found in project. Available targets: ${availableTargets.map(t => t.name).join(', ')}`);
          }
        }
      } else {
        // Target is already a specific name, verify it exists
        const targetExists = availableTargets.some(t => t.name === target);
        if (!targetExists) {
          throw new Error(`Target "${target}" not found in project. Available targets: ${availableTargets.map(t => t.name).join(', ')}`);
        }
      }
    } else {
      // No target files found, might be a blueprint-only project
      Logger.debug('No target files found, using generic target name');
    }

    return {
      target: resolvedTarget,
      config,
      platform,
      projectPath,
      enginePath,
      clean,
      verbose,
      additionalArgs
    };
  }

  /**
   * Execute build using Build.bat
   */
  private static async executeBuildBat(
    buildBatPath: string,
    options: Required<BuildOptions>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Build command string with proper quoting
    const args = [
      options.target,
      options.platform,
      options.config,
      `-project="${options.projectPath}"`
    ];

    if (options.clean) {
      args.push('-clean');
    }

    if (options.verbose) {
      args.push('-verbose');
    }

    args.push(...options.additionalArgs);

    const command = `"${buildBatPath}" ${args.join(' ')}`;
    Logger.debug(`Executing: ${command}`);

    const childProcess = execa(command, {
      stdio: 'pipe',
      cwd: path.dirname(buildBatPath),
      shell: true // Still need shell for .bat files
    });

    // Stream output
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        process.stdout.write(data.toString());
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });
    }

    const result = await childProcess;
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }

  /**
   * Execute build using UnrealBuildTool directly
   */
  private static async executeUnrealBuildTool(
    enginePath: string,
    options: Required<BuildOptions>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const ubtPath = path.join(
      enginePath,
      'Engine',
      'Binaries',
      'DotNET',
      'UnrealBuildTool',
      `UnrealBuildTool${Platform.exeExtension()}`
    );

    if (!(await fs.pathExists(ubtPath))) {
      throw new Error(`UnrealBuildTool not found at: ${ubtPath}`);
    }

    // Build command arguments
    const args = [
      options.target,
      options.platform,
      options.config,
      `-project="${options.projectPath}"`
    ];

    if (options.clean) {
      args.push('-clean');
    }

    if (options.verbose) {
      args.push('-verbose');
    }

    args.push(...options.additionalArgs);

    const command = `"${ubtPath}" ${args.join(' ')}`;
    Logger.debug(`Executing: ${command}`);

    const childProcess = execa(command, {
      stdio: 'pipe',
      cwd: path.dirname(ubtPath),
      shell: true // Need shell for .exe on Windows
    });

    // Stream output
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        process.stdout.write(data.toString());
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });
    }

    const result = await childProcess;
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }

  /**
   * Get available build targets from project
   */
  static async getAvailableTargets(projectPath: string): Promise<Array<{ name: string; type: string }>> {
    try {
      // Determine project directory: if path ends with .uproject, use its parent directory
      let projectDir = projectPath;
      if (projectPath.endsWith('.uproject')) {
        projectDir = path.dirname(projectPath);
      }

      const sourceDir = path.join(projectDir, 'Source');
      if (!(await fs.pathExists(sourceDir))) {
        return [];
      }

      const targetFiles = await fs.readdir(sourceDir).then(files =>
        files.filter(f => f.endsWith('.Target.cs'))
      );

      return targetFiles.map(file => {
        const name = path.basename(file, '.Target.cs');
        let type = 'Game';
        if (name.toLowerCase().includes('editor')) {
          type = 'Editor';
        } else if (name.toLowerCase().includes('client')) {
          type = 'Client';
        } else if (name.toLowerCase().includes('server')) {
          type = 'Server';
        }

        return { name, type };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get default build options for project
   */
  static async getDefaultOptions(projectPath: string): Promise<Partial<BuildOptions>> {
    const targets = await this.getAvailableTargets(projectPath);
    const hasEditorTarget = targets.some(t => t.type === 'Editor');

    return {
      target: hasEditorTarget ? 'Editor' : 'Game',
      config: 'Development',
      platform: 'Win64'
    };
  }
}