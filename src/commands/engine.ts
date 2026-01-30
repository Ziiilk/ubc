import { Command } from 'commander';
import chalk from 'chalk';
import { EngineResolver } from '../core/engine-resolver';
import { Logger } from '../utils/logger';
import { ProjectDetector } from '../core/project-detector';

export function engineCommand(program: Command): void {
  program
    .command('engine')
    .description('Display engine information for the current project')
    .option('-p, --project <path>', 'Path to project directory or .uproject file')
    .option('-j, --json', 'Output result as JSON')
    .action(async (options) => {
      try {
        Logger.title('Engine Information');

        let projectPath = options.project || process.cwd();

        // First, try to detect project to get project path
        const projectResult = await ProjectDetector.detectProject({ cwd: projectPath });
        if (projectResult.project) {
          projectPath = projectResult.project.path;
        }

        // Resolve engine information
        const result = await EngineResolver.resolveEngine(projectPath);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.error) {
          Logger.error(result.error);
          process.exit(1);
        }

        // Display engine information
        if (result.engine) {
          const engine = result.engine;
          Logger.success(`Found engine: ${chalk.bold(engine.displayName || engine.associationId)}`);

          Logger.subTitle('Engine Details');
          console.log(`  Path: ${engine.path}`);

          if (engine.version) {
            console.log(`  Version: ${engine.version.MajorVersion}.${engine.version.MinorVersion}.${engine.version.PatchVersion}`);
            console.log(`  Build ID: ${engine.version.BuildId}`);
            console.log(`  Branch: ${engine.version.BranchName}`);
            console.log(`  Changelist: ${engine.version.Changelist}`);
            console.log(`  Promoted Build: ${engine.version.IsPromotedBuild ? 'Yes' : 'No'}`);
          }

          console.log(`  Association ID: ${engine.associationId}`);
          if (engine.installedDate) {
            console.log(`  Installed: ${engine.installedDate}`);
          }
        } else {
          Logger.warning('No engine installation found');
        }

        // Display project engine association
        if (result.uprojectEngine) {
          Logger.subTitle('Project Engine Association');
          console.log(`  GUID: ${result.uprojectEngine.guid}`);
          if (result.uprojectEngine.name) {
            console.log(`  Name: ${result.uprojectEngine.name}`);
          }
          if (result.uprojectEngine.path) {
            console.log(`  Path: ${result.uprojectEngine.path}`);
          }
          if (result.uprojectEngine.version) {
            console.log(`  Version: ${result.uprojectEngine.version}`);
          }

          if (!result.engine) {
            Logger.warning('Engine association found in project, but no matching engine installation detected');
          }
        }

        // Warnings
        if (result.warnings.length > 0) {
          Logger.subTitle('Warnings');
          result.warnings.forEach(warning => {
            console.log(`  • ${warning}`);
          });
        }

        console.log();
        if (result.engine) {
          Logger.success('Engine information retrieved successfully');
        } else {
          Logger.warning('Limited engine information available');
        }

      } catch (error) {
        Logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}