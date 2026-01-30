#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { listCommand } from '../commands/list';
import { engineCommand } from '../commands/engine';
import { buildCommand } from '../commands/build';
import { generateCommand } from '../commands/generate';
import { initCommand } from '../commands/init';
import { runCommand } from '../commands/run';
import { version, description } from '../../package.json';

const program = new Command();

program
  .name('uebuild')
  .description(description)
  .version(version)
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str))
  });

// Register commands
listCommand(program);
engineCommand(program);
buildCommand(program);
generateCommand(program);
initCommand(program);
runCommand(program);

// Global error handling
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name()
});

// Parse arguments
try {
  program.parse(process.argv);
} catch (error) {
  console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
}