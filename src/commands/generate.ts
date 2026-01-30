import { Command } from 'commander';
import chalk from 'chalk';
import { ProjectGenerator } from '../core/project-generator';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';

export function generateCommand(program: Command): void {
  program
    .command('generate')
    .alias('gen')
    .description('Generate IDE project files')
    .option('-i, --ide <ide>', 'IDE type (sln, vscode, clion, xcode, vs2022)', 'sln')
    .option('--project <path>', 'Path to project directory or .uproject file')
    .option('--engine-path <path>', 'Path to Unreal Engine installation')
    .option('--force', 'Force regeneration of project files')
    .option('--list-ides', 'List available IDE types')
    .action(async (options) => {
      try {
        Logger.title('Generate Project Files');

        // List IDEs if requested
        if (options.listIdes) {
          listAvailableIDEs();
          return;
        }

        // Validate IDE type
        if (!Validator.isValidIDE(options.ide)) {
          Logger.error(`Invalid IDE type: ${options.ide}`);
          listAvailableIDEs();
          process.exit(1);
        }

        // Execute generation
        Logger.info(`Generating ${options.ide.toUpperCase()} project files...`);
        Logger.divider();

        const result = await ProjectGenerator.generate({
          ide: options.ide,
          projectPath: options.project,
          enginePath: options.enginePath,
          force: options.force
        });

        Logger.divider();

        if (result.success) {
          Logger.success('Project files generated successfully');

          if (result.generatedFiles.length > 0) {
            Logger.subTitle('Generated Files');
            result.generatedFiles.forEach(file => {
              console.log(`  • ${file}`);
            });
          }

          // IDE-specific instructions
          if (options.ide === 'sln' || options.ide === 'vs2022') {
            console.log();
            console.log(`Open ${chalk.bold('.sln')} file in Visual Studio to build and debug.`);
          } else if (options.ide === 'vscode') {
            console.log();
            console.log(`Open project folder in ${chalk.bold('Visual Studio Code')}.`);
            console.log(`Build tasks are available in the Tasks menu.`);
          }

        } else {
          Logger.error(`Failed to generate project files: ${result.error}`);
          process.exit(1);
        }

      } catch (error) {
        Logger.error(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

function listAvailableIDEs(): void {
  Logger.subTitle('Available IDE Types');

  const ides = [
    { id: 'sln', name: 'Visual Studio Solution', description: 'Standard .sln file for Visual Studio' },
    { id: 'vs2022', name: 'Visual Studio 2022', description: 'Visual Studio 2022 solution files' },
    { id: 'vscode', name: 'Visual Studio Code', description: '.vscode configuration files with build tasks' },
    { id: 'clion', name: 'CLion', description: 'CMake project for CLion' },
    { id: 'xcode', name: 'Xcode', description: 'Xcode project files (macOS only)' }
  ];

  ides.forEach(ide => {
    console.log(`  ${chalk.bold(ide.id.padEnd(8))} ${ide.name}`);
    console.log(`            ${chalk.gray(ide.description)}`);
    console.log();
  });

  console.log('Use: uebuild generate --ide <type>');
}