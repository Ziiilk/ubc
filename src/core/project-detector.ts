import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { UProject, ProjectInfo, ProjectDetectionOptions, ProjectDetectionResult } from '../types/project';

export class ProjectDetector {
  /**
   * Detect Unreal Engine project in the given directory
   */
  static async detectProject(options: ProjectDetectionOptions = {}): Promise<ProjectDetectionResult> {
    const cwd = options.cwd || process.cwd();
    const warnings: string[] = [];

    try {
      // Find .uproject files
      const uprojectFiles = await this.findUProjectFiles(cwd, options.recursive);

      if (uprojectFiles.length === 0) {
        return {
          isValid: false,
          error: 'No Unreal Engine project (.uproject) file found',
          warnings
        };
      }

      // For now, use the first found .uproject file
      // In the future, we might support multiple projects or let user choose
      const uprojectPath = uprojectFiles[0];
      const projectDir = path.dirname(uprojectPath);

      // Parse .uproject file
      const uproject = await this.parseUProject(uprojectPath);

      // Validate .uproject structure
      const validationResult = this.validateUProject(uproject);
      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: `Invalid .uproject file: ${validationResult.error}`,
          warnings: [...warnings, ...validationResult.warnings]
        };
      }

      // Get project name from .uproject filename
      const projectName = path.basename(uprojectPath, '.uproject');

      // Check Source directory
      const sourceDir = path.join(projectDir, 'Source');
      const hasSourceDir = await fs.pathExists(sourceDir);

      if (!hasSourceDir) {
        warnings.push('Source directory not found - this may be a blueprint-only project');
      }

      // Find target files
      const targets = hasSourceDir ? await this.findTargetFiles(sourceDir) : [];

      // Find module files
      const modules = hasSourceDir ? await this.findModuleFiles(sourceDir) : [];

      // Build project info
      const projectInfo: ProjectInfo = {
        name: projectName,
        path: projectDir,
        uproject,
        sourceDir: hasSourceDir ? sourceDir : '',
        targets,
        modules
      };

      return {
        isValid: true,
        project: projectInfo,
        warnings
      };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
        warnings
      };
    }
  }

  /**
   * Find .uproject files in the directory
   */
  private static async findUProjectFiles(cwd: string, recursive?: boolean): Promise<string[]> {
    const pattern = recursive ? '**/*.uproject' : '*.uproject';
    return await glob(pattern, { cwd, absolute: true });
  }

  /**
   * Parse .uproject JSON file
   */
  private static async parseUProject(uprojectPath: string): Promise<UProject> {
    const content = await fs.readFile(uprojectPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Validate .uproject structure
   */
  private static validateUProject(uproject: UProject): { isValid: boolean; error?: string; warnings: string[] } {
    const warnings: string[] = [];

    // Check required fields
    if (uproject.FileVersion === undefined) {
      return { isValid: false, error: 'Missing FileVersion field', warnings };
    }

    if (uproject.FileVersion !== 3) {
      warnings.push(`Unexpected FileVersion: ${uproject.FileVersion}. Expected 3.`);
    }

    if (!uproject.EngineAssociation) {
      return { isValid: false, error: 'Missing EngineAssociation field', warnings };
    }

    if (!uproject.Modules || !Array.isArray(uproject.Modules)) {
      return { isValid: false, error: 'Missing or invalid Modules array', warnings };
    }

    return { isValid: true, warnings };
  }

  /**
   * Find target files (*.Target.cs) in Source directory
   */
  private static async findTargetFiles(sourceDir: string): Promise<ProjectInfo['targets']> {
    const files = await glob('*.Target.cs', { cwd: sourceDir, absolute: false });

    const targets = files.map(file => {
      const fileName = path.basename(file, '.Target.cs');
      let type: 'Editor' | 'Game' | 'Client' | 'Server' = 'Game';

      // Try to determine type from filename
      if (fileName.toLowerCase().includes('editor')) {
        type = 'Editor';
      } else if (fileName.toLowerCase().includes('client')) {
        type = 'Client';
      } else if (fileName.toLowerCase().includes('server')) {
        type = 'Server';
      }

      return {
        name: fileName,
        type,
        path: path.join(sourceDir, file)
      };
    });

    return targets;
  }

  /**
   * Find module files (*.Build.cs) in Source directory
   */
  private static async findModuleFiles(sourceDir: string): Promise<ProjectInfo['modules']> {
    const files = await glob('**/*.Build.cs', { cwd: sourceDir, absolute: false });

    const modules = files.map(file => {
      const moduleName = path.basename(file, '.Build.cs');
      return {
        name: moduleName,
        path: path.join(sourceDir, file)
      };
    });

    return modules;
  }
}