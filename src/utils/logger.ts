import chalk from 'chalk';

export class Logger {
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  static warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🔍'), message);
    }
  }

  static progress(message: string): void {
    process.stdout.write(chalk.cyan('»') + ' ' + message + '\r');
  }

  static clearProgress(): void {
    process.stdout.write(' '.repeat(process.stdout.columns) + '\r');
  }

  static divider(): void {
    console.log(chalk.gray('─'.repeat(80)));
  }

  static title(title: string): void {
    console.log('\n' + chalk.bold.cyan(title));
    console.log(chalk.cyan('═'.repeat(title.length)));
  }

  static subTitle(subTitle: string): void {
    console.log('\n' + chalk.bold(subTitle));
    console.log(chalk.gray('─'.repeat(subTitle.length)));
  }

  static json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}