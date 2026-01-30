import { Command } from 'commander';
import chalk from 'chalk';
import { ProjectDetector } from '../core/project-detector';
import { Logger } from '../utils/logger';

export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('Detect Unreal Engine project in current directory')
    .option('-r, --recursive', 'Search recursively for .uproject files')
    .option('-j, --json', 'Output result as JSON')
    .action(async (options) => {
      try {
        Logger.title('Project Detection');

        const result = await ProjectDetector.detectProject({
          cwd: process.cwd(),
          recursive: options.recursive
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (!result.isValid) {
          Logger.error(result.error || 'Project detection failed');
          if (result.warnings.length > 0) {
            Logger.warning('Warnings:');
            result.warnings.forEach(warning => console.log(`  • ${warning}`));
          }
          process.exit(1);
        }

        if (!result.project) {
          Logger.error('No project found');
          process.exit(1);
        }

        const project = result.project;

        // Display project information
        Logger.success(`Found project: ${chalk.bold(project.name)}`);
        console.log();

        // Basic info
        Logger.subTitle('Basic Information');
        console.log(`  Path: ${project.path}`);
        console.log(`  Source Directory: ${project.sourceDir || 'Not found'}`);
        console.log(`  Engine Association: ${project.uproject.EngineAssociation}`);

        // Modules
        if (project.uproject.Modules.length > 0) {
          Logger.subTitle('Modules');
          project.uproject.Modules.forEach(module => {
            console.log(`  • ${module.Name} (${module.Type}) - Loading: ${module.LoadingPhase}`);
          });
        }

        // Build Targets
        if (project.targets.length > 0) {
          Logger.subTitle('Build Targets');
          project.targets.forEach(target => {
            console.log(`  • ${target.name} (${target.type})`);
          });
        }

        // Source Modules
        if (project.modules.length > 0) {
          Logger.subTitle('Source Modules');
          project.modules.forEach(module => {
            console.log(`  • ${module.name}`);
          });
        }

        // Plugins
        if (project.uproject.Plugins && project.uproject.Plugins.length > 0) {
          Logger.subTitle('Plugins');
          project.uproject.Plugins.forEach(plugin => {
            const status = plugin.Enabled ? chalk.green('Enabled') : chalk.gray('Disabled');
            console.log(`  • ${plugin.Name} - ${status}`);
          });
        }

        // Warnings
        if (result.warnings.length > 0) {
          Logger.subTitle('Warnings');
          result.warnings.forEach(warning => {
            console.log(`  • ${warning}`);
          });
        }

        console.log();
        Logger.success('Project detection complete');

      } catch (error) {
        Logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}