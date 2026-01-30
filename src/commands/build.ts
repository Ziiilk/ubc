import { Command } from 'commander';
import chalk from 'chalk';
import { BuildExecutor } from '../core/build-executor';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';

export function buildCommand(program: Command): void {
  program
    .command('build')
    .description('Build Unreal Engine project')
    .option('-t, --target <target>', 'Build target (Editor, Game, Client, Server)', 'Editor')
    .option('-c, --config <config>', 'Build configuration (Debug, DebugGame, Development, Shipping, Test)', 'Development')
    .option('-p, --platform <platform>', 'Build platform (Win64, Win32, Linux, Mac, Android, IOS)', 'Win64')
    .option('--project <path>', 'Path to project directory or .uproject file')
    .option('--engine-path <path>', 'Path to Unreal Engine installation')
    .option('--clean', 'Clean build (rebuild everything)')
    .option('--verbose', 'Verbose output')
    .option('--dry-run', 'Show what would be built without actually building')
    .option('--list-targets', 'List available build targets for project')
    .action(async (options) => {
      try {
        Logger.title('Unreal Engine Build');

        // List targets if requested
        if (options.listTargets) {
          await listAvailableTargets(options.project);
          return;
        }

        // Validate options
        if (!Validator.isValidBuildTarget(options.target)) {
          Logger.error(`Invalid build target: ${options.target}`);
          Logger.info('Valid generic targets: Editor, Game, Client, Server');
          Logger.info('Use --list-targets to see available project-specific targets');
          process.exit(1);
        }

        if (!Validator.isValidBuildConfig(options.config)) {
          Logger.error(`Invalid build configuration: ${options.config}`);
          Logger.info('Valid configurations: Debug, DebugGame, Development, Shipping, Test');
          process.exit(1);
        }

        if (!Validator.isValidBuildPlatform(options.platform)) {
          Logger.error(`Invalid build platform: ${options.platform}`);
          Logger.info('Valid platforms: Win64, Win32, Linux, Mac, Android, IOS');
          process.exit(1);
        }

        // Dry run
        if (options.dryRun) {
          await dryRunBuild(options);
          return;
        }

        // Execute build
        Logger.info(`Preparing to build: ${chalk.bold(options.target)} | ${chalk.bold(options.platform)} | ${chalk.bold(options.config)}`);
        Logger.divider();

        const startTime = Date.now();
        const result = await BuildExecutor.execute({
          target: options.target,
          config: options.config,
          platform: options.platform,
          projectPath: options.project,
          enginePath: options.enginePath,
          clean: options.clean,
          verbose: options.verbose
        });

        Logger.divider();
        const duration = (Date.now() - startTime) / 1000;

        if (result.success) {
          Logger.success(`Build completed successfully in ${duration.toFixed(1)}s`);
          Logger.info(`Output directory: ${result.stdout.match(/Output path: (.+)/)?.[1] || 'Unknown'}`);
        } else {
          Logger.error(`Build failed after ${duration.toFixed(1)}s`);
          if (result.error) {
            Logger.error(result.error);
          }

          // Show error summary
          if (result.stderr) {
            const errorLines = result.stderr.split('\n').filter(line =>
              line.toLowerCase().includes('error') ||
              line.toLowerCase().includes('failed') ||
              line.toLowerCase().includes('fatal')
            );

            if (errorLines.length > 0) {
              Logger.subTitle('Error Summary');
              errorLines.slice(0, 10).forEach(line => {
                console.log(`  ${chalk.red('•')} ${line.trim()}`);
              });

              if (errorLines.length > 10) {
                console.log(`  ${chalk.gray(`... and ${errorLines.length - 10} more errors`)}`);
              }
            }
          }

          process.exit(result.exitCode || 1);
        }

      } catch (error) {
        Logger.error(`Build preparation failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function listAvailableTargets(projectPath?: string): Promise<void> {
  try {
    const path = projectPath || process.cwd();
    const targets = await BuildExecutor.getAvailableTargets(path);

    Logger.subTitle('Available Build Targets');

    if (targets.length === 0) {
      console.log('  No build targets found');
      console.log();
      console.log('Make sure:');
      console.log('  • You are in a Unreal Engine project directory');
      console.log('  • The project has Source/*.Target.cs files');
      console.log('  • The project is a C++ project (Blueprint-only projects have no build targets)');
    } else {
      targets.forEach(target => {
        const typeLabel = chalk.gray(`(${target.type})`);
        console.log(`  • ${chalk.bold(target.name)} ${typeLabel}`);
      });

      console.log();
      console.log('Use: uebuild build --target <target>');
    }
  } catch (error) {
    Logger.error(`Failed to list targets: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function dryRunBuild(options: any): Promise<void> {
  Logger.subTitle('Dry Run - Build Configuration');

  console.log(`  Project: ${options.project || 'Current directory'}`);
  console.log(`  Target: ${options.target}`);
  console.log(`  Configuration: ${options.config}`);
  console.log(`  Platform: ${options.platform}`);
  console.log(`  Clean Build: ${options.clean ? 'Yes' : 'No'}`);
  console.log(`  Verbose: ${options.verbose ? 'Yes' : 'No'}`);

  // Try to detect engine
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

  console.log();
  Logger.info('This is a dry run - no actual build will be performed');
  console.log('To execute the build, remove the --dry-run flag');
}