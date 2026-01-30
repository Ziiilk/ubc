// API exports for programmatic usage

// Core functionality
import { ProjectDetector } from './core/project-detector';
import { EngineResolver } from './core/engine-resolver';
import { BuildExecutor } from './core/build-executor';
import { ProjectGenerator } from './core/project-generator';
import { ProjectInitializer } from './core/project-initializer';

// Utilities
import { Logger } from './utils/logger';
import { Validator } from './utils/validator';
import { FileSystem } from './utils/file-system';
import { Platform } from './utils/platform';

// Re-exports
export { ProjectDetector, EngineResolver, BuildExecutor, ProjectGenerator, ProjectInitializer };
export { Logger, Validator, FileSystem, Platform };

// Types
export * from './types/project';
export * from './types/engine';
export * from './types/build';
export * from './types/generate';
export * from './types/init';

// Command functions (for programmatic usage)
import { listCommand } from './commands/list';
import { engineCommand } from './commands/engine';
import { buildCommand } from './commands/build';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';

export { listCommand, engineCommand, buildCommand, generateCommand, initCommand };

/**
 * Main API for programmatic usage
 */
export class UEBuildAPI {
  static project = {
    detect: ProjectDetector.detectProject.bind(ProjectDetector)
  };

  static engine = {
    resolve: EngineResolver.resolveEngine.bind(EngineResolver)
  };

  static build = {
    execute: BuildExecutor.execute.bind(BuildExecutor),
    getAvailableTargets: BuildExecutor.getAvailableTargets.bind(BuildExecutor),
    getDefaultOptions: BuildExecutor.getDefaultOptions.bind(BuildExecutor)
  };

  static generate = {
    generate: ProjectGenerator.generate.bind(ProjectGenerator)
  };

  static init = {
    initialize: ProjectInitializer.initialize.bind(ProjectInitializer)
  };

  static utils = {
    logger: Logger,
    validator: Validator,
    fileSystem: FileSystem,
    platform: Platform
  };
}

// Default export
export default UEBuildAPI;