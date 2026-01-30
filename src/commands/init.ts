import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { ProjectInitializer } from '../core/project-initializer';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Unreal Engine project')
    .requiredOption('-n, --name <name>', 'Project name (alphanumeric, underscores, hyphens)')
    .option('-t, --type <type>', 'Project type (cpp, blueprint, blank)', 'cpp')
    .option('--template <template>', 'Project template (Basic, FirstPerson, ThirdPerson, etc.)', 'Basic')
    .option('-d, --directory <path>', 'Directory to create project in (default: ./<name>)')
    .option('--engine-path <path>', 'Path to Unreal Engine installation')
    .option('--force', 'Force initialization even if directory is not empty')
    .option('--dry-run', 'Show what would be created without actually creating')
    .action(async (options) => {
      try {
        Logger.title('Initialize Unreal Engine Project');

        // Dry run
        if (options.dryRun) {
          await dryRunInit(options);
          return;
        }

        // Validate project name
        if (!Validator.isValidProjectName(options.name)) {
          Logger.error(`Invalid project name: ${options.name}`);
          Logger.info('Project name can only contain: a-z, A-Z, 0-9, _, -');
          process.exit(1);
        }

        // Validate project type
        if (!Validator.isValidProjectType(options.type)) {
          Logger.error(`Invalid project type: ${options.type}`);
          Logger.info('Valid types: cpp, blueprint, blank');
          process.exit(1);
        }

        // Execute initialization
        Logger.info(`Initializing ${chalk.bold(options.name)} as ${options.type.toUpperCase()} project`);
        Logger.divider();

        const result = await ProjectInitializer.initialize({
          name: options.name,
          type: options.type,
          template: options.template,
          enginePath: options.enginePath,
          directory: options.directory,
          force: options.force
        });

        Logger.divider();

        if (result.success) {
          Logger.success(`Project ${chalk.bold(options.name)} initialized successfully!`);

          // Show project structure
          Logger.subTitle('Project Structure');
          console.log(`  ${result.projectPath}/`);
          console.log(`  ├── ${options.name}.uproject`);
          console.log(`  ├── Config/`);
          console.log(`  │   ├── DefaultEngine.ini`);
          console.log(`  │   ├── DefaultGame.ini`);
          console.log(`  │   └── DefaultEditor.ini`);

          if (options.type === 'cpp') {
            console.log(`  ├── Source/`);
            console.log(`  │   ├── ${options.name}.Target.cs`);
            console.log(`  │   ├── ${options.name}Editor.Target.cs`);
            console.log(`  │   └── ${options.name}/`);
            console.log(`  │       ├── ${options.name}.Build.cs`);
            console.log(`  │       ├── Public/`);
            console.log(`  │       │   ├── ${options.name}.h`);
            console.log(`  │       │   └── ${options.name}GameModeBase.h`);
            console.log(`  │       └── Private/`);
            console.log(`  │           ├── ${options.name}.cpp`);
            console.log(`  │           └── ${options.name}GameModeBase.cpp`);
            console.log(`  └── Content/`);
          } else {
            console.log(`  └── Content/`);
          }

          console.log();
          Logger.subTitle('Next Steps');

          if (options.type === 'cpp') {
            console.log(`  1. Generate project files: ${chalk.bold(`uebuild generate --project "${result.projectPath}"`)}`);
            console.log(`  2. Build the project: ${chalk.bold(`uebuild build --project "${result.projectPath}"`)}`);
            console.log(`  3. Open in editor: ${chalk.bold(`Double-click ${options.name}.uproject`)}`);
          } else {
            console.log(`  1. Open in editor: ${chalk.bold(`Double-click ${options.name}.uproject`)}`);
            console.log(`  2. Start creating Blueprints in the Content directory`);
          }

          console.log();
          Logger.info(`Project location: ${result.projectPath}`);
          console.log(`Engine association: ${result.engineAssociation}`);

        } else {
          Logger.error(`Failed to initialize project: ${result.error}`);
          process.exit(1);
        }

      } catch (error) {
        Logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function dryRunInit(options: any): Promise<void> {
  Logger.subTitle('Dry Run - Project Initialization');

  console.log(`  Project Name: ${options.name}`);
  console.log(`  Project Type: ${options.type}`);
  console.log(`  Template: ${options.template}`);
  console.log(`  Directory: ${options.directory || `./${options.name}`}`);
  console.log(`  Force: ${options.force ? 'Yes' : 'No'}`);

  // Try to detect engine
  if (options.enginePath) {
    console.log(`  Engine Path: ${options.enginePath}`);
  } else {
    try {
      const { EngineResolver } = await import('../core/engine-resolver');
      const engines = await EngineResolver.findEngineInstallations();

      if (engines.length === 0) {
        console.log(`  Engine: ${chalk.yellow('No engines found - will prompt for path')}`);
      } else if (engines.length === 1) {
        console.log(`  Engine: ${engines[0].displayName || engines[0].associationId}`);
      } else {
        console.log(`  Engine: ${chalk.yellow('Multiple engines available - will prompt for selection')}`);
        engines.forEach((engine, i) => {
          const version = engine.version
            ? `UE ${engine.version.MajorVersion}.${engine.version.MinorVersion}.${engine.version.PatchVersion}`
            : 'Unknown version';
          console.log(`    ${i + 1}. ${engine.displayName || engine.associationId} (${version})`);
        });
      }
    } catch {
      console.log(`  Engine: ${chalk.yellow('Detection failed - will prompt for path')}`);
    }
  }

  // Show what would be created
  console.log();
  Logger.subTitle('What would be created:');

  const directory = options.directory || path.join(process.cwd(), options.name);
  console.log(`  ${directory}/`);
  console.log(`  ├── ${options.name}.uproject`);
  console.log(`  ├── Config/`);
  console.log(`  │   └── *.ini files`);

  if (options.type === 'cpp') {
    console.log(`  ├── Source/`);
    console.log(`  │   ├── ${options.name}.Target.cs`);
    console.log(`  │   ├── ${options.name}Editor.Target.cs`);
    console.log(`  │   └── ${options.name}/`);
    console.log(`  │       ├── ${options.name}.Build.cs`);
    console.log(`  │       ├── Public/`);
    console.log(`  │       └── Private/`);
    console.log(`  └── Content/`);
  } else {
    console.log(`  └── Content/`);
  }

  console.log();
  Logger.info('This is a dry run - no files will be created');
  console.log('To actually create the project, remove the --dry-run flag');
}