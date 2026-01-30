import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { BuildExecutor } from '../core/build-executor';
import { EngineResolver } from '../core/engine-resolver';

export function runCommand(program: Command): void {
  program
    .command('run')
    .description('Run Unreal Engine project (Editor or Game executable)')
    .option('-t, --target <target>', 'Run target (Editor, Game, Client, Server)', 'Editor')
    .option('-c, --config <config>', 'Build configuration (Debug, DebugGame, Development, Shipping, Test)', 'Development')
    .option('-p, --platform <platform>', 'Platform (Win64, Win32, Linux, Mac, Android, IOS)', 'Win64')
    .option('--project <path>', 'Path to project directory or .uproject file')
    .option('--engine-path <path>', 'Path to Unreal Engine installation')
    .option('--dry-run', 'Show what would be run without actually running')
    .option('--build-first', 'Build the project before running')
    .option('--no-build', 'Do not build, just run existing executable')
    .option('--args <args...>', 'Additional arguments to pass to the executable')
    .action(async (options) => {
      try {
        Logger.title('Run Unreal Engine Project');

        // Validate options
        if (!Validator.isValidBuildTarget(options.target)) {
          Logger.error(`Invalid run target: ${options.target}`);
          Logger.info('Valid targets: Editor, Game, Client, Server');
          process.exit(1);
        }

        if (!Validator.isValidBuildConfig(options.config)) {
          Logger.error(`Invalid build configuration: ${options.config}`);
          Logger.info('Valid configurations: Debug, DebugGame, Development, Shipping, Test');
          process.exit(1);
        }

        if (!Validator.isValidBuildPlatform(options.platform)) {
          Logger.error(`Invalid platform: ${options.platform}`);
          Logger.info('Valid platforms: Win64, Win32, Linux, Mac, Android, IOS');
          process.exit(1);
        }

        // Dry run
        if (options.dryRun) {
          await dryRun(options);
          return;
        }

        // Execute run
        await runProject(options);

      } catch (error) {
        Logger.error(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function dryRun(options: any): Promise<void> {
  Logger.subTitle('Dry Run - Run Configuration');

  console.log(`  Project: ${options.project || 'Current directory'}`);
  console.log(`  Target: ${options.target}`);
  console.log(`  Configuration: ${options.config}`);
  console.log(`  Platform: ${options.platform}`);
  console.log(`  Build First: ${options.buildFirst ? 'Yes' : 'No'}`);
  console.log(`  Additional Args: ${options.args ? options.args.join(' ') : 'None'}`);

  // Try to detect engine and project
  try {
    const { EngineResolver } = await import('../core/engine-resolver');
    const engineResult = await EngineResolver.resolveEngine(options.project);
    if (engineResult.engine) {
      console.log(`  Engine: ${engineResult.engine.displayName || engineResult.engine.path}`);
    } else {
      console.log(`  Engine: ${chalk.yellow('Not detected - specify with --engine-path')}`);
    }
  } catch {
    console.log(`  Engine: ${chalk.yellow('Detection failed - specify with --engine-path')}`);
  }

  // Try to find executable
  try {
    const executablePath = await findExecutable(options);
    if (executablePath && await fs.pathExists(executablePath)) {
      console.log(`  Executable: ${executablePath}`);
      console.log(`  Executable exists: ${chalk.green('Yes')}`);
    } else if (executablePath) {
      console.log(`  Executable: ${executablePath}`);
      console.log(`  Executable exists: ${chalk.yellow('No - may need to build first')}`);
    } else {
      console.log(`  Executable: ${chalk.yellow('Could not determine path')}`);
    }
  } catch {
    console.log(`  Executable: ${chalk.yellow('Path detection failed')}`);
  }

  console.log();
  Logger.info('This is a dry run - no actual run will be performed');
  console.log('To execute the run, remove the --dry-run flag');
}

async function runProject(options: any): Promise<void> {
  const startTime = Date.now();

  // Determine project path
  let projectPath = options.project || process.cwd();
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

  // Validate project file
  if (!(await fs.pathExists(projectPath))) {
    throw new Error(`Project file not found: ${projectPath}`);
  }

  // Resolve engine path
  let enginePath = options.enginePath;
  if (!enginePath) {
    const engineResult = await EngineResolver.resolveEngine(projectPath);
    if (!engineResult.engine) {
      throw new Error('Could not determine engine path. Please specify --engine-path');
    }
    enginePath = engineResult.engine.path;
    Logger.debug(`Resolved engine path: ${enginePath}`);
  }

  // Build first if requested
  if (options.buildFirst === true) { // Only build if --build-first flag is explicitly set
    Logger.info('Building project before running...');
    const buildResult = await BuildExecutor.execute({
      target: options.target,
      config: options.config,
      platform: options.platform,
      projectPath: projectPath,
      enginePath: options.enginePath,
      verbose: false
    });

    if (!buildResult.success) {
      Logger.error('Build failed. Cannot run project.');
      process.exit(buildResult.exitCode || 1);
    }
  }

  // Find and run executable
  options.enginePath = enginePath;
  const executablePath = await findExecutable(options);
  if (!executablePath) {
    throw new Error('Could not determine executable path');
  }

  if (!(await fs.pathExists(executablePath))) {
    throw new Error(`Executable not found: ${executablePath}\nTry building the project first with --build-first`);
  }

  Logger.info(`Running: ${chalk.bold(path.basename(executablePath))}`);
  Logger.divider();

  // Prepare arguments
  const args = options.args || [];

  // For Editor targets, add project path as argument
  const targetLower = options.target.toLowerCase();
  if (targetLower.includes('editor')) {
    args.unshift(projectPath);
  }

  // Execute
  try {
    const childProcess = execa(executablePath, args, {
      stdio: 'inherit',
      cwd: path.dirname(executablePath)
    });

    // Handle process exit
    childProcess.on('exit', (code) => {
      Logger.divider();
      const duration = (Date.now() - startTime) / 1000;
      if (code === 0) {
        Logger.success(`Process completed successfully in ${duration.toFixed(1)}s`);
      } else {
        Logger.error(`Process exited with code ${code} after ${duration.toFixed(1)}s`);
      }
    });

    // Handle signals
    process.on('SIGINT', () => {
      childProcess.kill('SIGINT');
    });

    await childProcess;
  } catch (error) {
    Logger.error(`Failed to run executable: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function findExecutable(options: any): Promise<string | null> {
  try {
    // Determine project path and name
    let projectPath = options.project || process.cwd();
    let projectDir = projectPath;
    let projectName = '';

    if (await fs.pathExists(projectPath) && (await fs.stat(projectPath)).isDirectory()) {
      const uprojectFiles = await fs.readdir(projectPath).then(files =>
        files.filter(f => f.endsWith('.uproject'))
      );
      if (uprojectFiles.length > 0) {
        projectName = path.basename(uprojectFiles[0], '.uproject');
      }
    } else if (projectPath.endsWith('.uproject')) {
      projectDir = path.dirname(projectPath);
      projectName = path.basename(projectPath, '.uproject');
    }

    if (!projectName) {
      return null;
    }

    // Get actual target name (resolve generic to specific)
    let targetName = options.target;
    const availableTargets = await BuildExecutor.getAvailableTargets(projectPath);
    if (availableTargets.length > 0) {
      const genericTypes = ['Editor', 'Game', 'Client', 'Server'];
      const isGenericType = genericTypes.includes(options.target);
      if (isGenericType) {
        const matchingTarget = availableTargets.find(t => t.type === options.target);
        if (matchingTarget) {
          targetName = matchingTarget.name;
        }
      }
    }

    // Determine if target is editor
    const isEditor = targetName.toLowerCase().includes('editor');

    // For editor targets, use UnrealEditor.exe from engine
    if (isEditor) {
      let enginePath = options.enginePath;
      // Resolve engine path if not provided
      if (!enginePath) {
        const engineResult = await EngineResolver.resolveEngine(projectPath);
        if (!engineResult.engine) {
          Logger.warning('Could not resolve engine path for editor target');
          return null;
        }
        enginePath = engineResult.engine.path;
      }

      // Editor executable path
      const editorExePath = path.join(
        enginePath,
        'Engine',
        'Binaries',
        options.platform,
        'UnrealEditor.exe'
      );

      if (await fs.pathExists(editorExePath)) {
        return editorExePath;
      } else {
        // Fallback to alternative editor executable names
        const alternativePaths = [
          path.join(enginePath, 'Engine', 'Binaries', options.platform, 'UnrealEditor-Cmd.exe'),
          path.join(enginePath, 'Engine', 'Binaries', options.platform, 'UE4Editor.exe'),
          path.join(enginePath, 'Engine', 'Binaries', options.platform, 'UE5Editor.exe'),
        ];

        for (const altPath of alternativePaths) {
          if (await fs.pathExists(altPath)) {
            return altPath;
          }
        }

        // Return the expected path even if it doesn't exist (will throw error later)
        return editorExePath;
      }
    }

    // For non-editor targets (Game, Client, Server)
    const executableName = `${projectName}.exe`;

    // Common executable locations
    const possiblePaths = [
      // Build output location
      path.join(projectDir, 'Binaries', options.platform, executableName),
      // Development build location
      path.join(projectDir, 'Binaries', options.platform, `${projectName}-${options.platform}-${options.config}`, executableName),
      // With target name
      path.join(projectDir, 'Binaries', options.platform, `${targetName}.exe`),
      path.join(projectDir, 'Binaries', options.platform, `${targetName}-${options.platform}-${options.config}.exe`),
    ].filter(Boolean) as string[];

    // Find first existing path
    for (const possiblePath of possiblePaths) {
      if (await fs.pathExists(possiblePath)) {
        return possiblePath;
      }
    }

    // If not found, return the most likely path
    return path.join(projectDir, 'Binaries', options.platform, executableName);
  } catch {
    return null;
  }
}