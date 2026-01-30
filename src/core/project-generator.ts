import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import { GenerateOptions, GenerateResult, IDE } from '../types/generate';
import { Logger } from '../utils/logger';
import { Platform } from '../utils/platform';

export class ProjectGenerator {
  /**
   * Generate IDE project files
   */
  static async generate(options: GenerateOptions): Promise<GenerateResult> {
    const generatedFiles: string[] = [];

    try {
      // Validate options
      const validatedOptions = await this.validateOptions(options);
      const { ide, projectPath, enginePath, force } = validatedOptions;

      Logger.info(`Generating ${ide.toUpperCase()} project files`);
      Logger.info(`Project: ${projectPath}`);
      Logger.info(`Engine: ${enginePath}`);

      // Generate using UnrealBuildTool
      if (ide === 'sln' || ide === 'vs2022') {
        await this.generateWithUBT(enginePath, projectPath, force);
        generatedFiles.push(...await this.findGeneratedSolutionFiles(projectPath));
      } else if (ide === 'vscode') {
        await this.generateWithUBT(enginePath, projectPath, force);
        await this.generateVSCodeConfig(projectPath);
        generatedFiles.push(...await this.findGeneratedSolutionFiles(projectPath));
        generatedFiles.push(...await this.findVSCodeConfigFiles(projectPath));
      } else {
        // For other IDEs, just use UBT
        await this.generateWithUBT(enginePath, projectPath, force);
        generatedFiles.push(...await this.findGeneratedSolutionFiles(projectPath));
      }

      return {
        success: true,
        generatedFiles
      };

    } catch (error) {
      return {
        success: false,
        generatedFiles,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate and complete generate options
   */
  private static async validateOptions(options: GenerateOptions): Promise<Required<GenerateOptions>> {
    const ide: IDE = options.ide || 'sln';
    const force = options.force || false;

    // Validate project path
    let projectPath = options.projectPath || process.cwd();
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

    // Validate engine path
    let enginePath = options.enginePath;
    if (!enginePath) {
      // Try to resolve engine path
      const { EngineResolver } = await import('./engine-resolver');
      const engineResult = await EngineResolver.resolveEngine(projectPath);
      if (!engineResult.engine) {
        throw new Error('Could not determine engine path. Please specify --engine-path');
      }
      enginePath = engineResult.engine.path;
    }

    // Validate engine path exists
    if (!(await fs.pathExists(enginePath))) {
      throw new Error(`Engine path does not exist: ${enginePath}`);
    }

    return {
      ide,
      projectPath,
      enginePath,
      force
    };
  }

  /**
   * Generate project files using UnrealBuildTool
   */
  private static async generateWithUBT(
    enginePath: string,
    projectPath: string,
    force: boolean
  ): Promise<void> {
    const ubtPath = path.join(
      enginePath,
      'Engine',
      'Binaries',
      'DotNET',
      'UnrealBuildTool',
      `UnrealBuildTool${Platform.exeExtension()}`
    );

    if (!(await fs.pathExists(ubtPath))) {
      throw new Error(`UnrealBuildTool not found at: ${ubtPath}`);
    }

    const args = [
      '-projectfiles',
      `-project="${projectPath}"`,
      '-game',
      '-engine'
    ];

    if (force) {
      args.push('-force');
    }

    Logger.debug(`Executing: ${ubtPath} ${args.join(' ')}`);

    const command = `"${ubtPath}" ${args.join(' ')}`;
    const childProcess = execa(command, {
      stdio: 'pipe',
      cwd: path.dirname(ubtPath),
      shell: true
    });

    // Stream output
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (!output.includes('Log file created')) {
          process.stdout.write(output);
        }
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });
    }

    const result = await childProcess;

    if (result.exitCode !== 0) {
      throw new Error(`Project generation failed with exit code ${result.exitCode}`);
    }

    Logger.success('Project files generated successfully');
  }

  /**
   * Generate VSCode configuration files
   */
  private static async generateVSCodeConfig(projectPath: string): Promise<void> {
    const projectDir = path.dirname(projectPath);
    const vscodeDir = path.join(projectDir, '.vscode');

    await fs.ensureDir(vscodeDir);

    // Create tasks.json
    const tasksJson = {
      version: '2.0.0',
      tasks: [
        {
          label: 'Build Editor (Development)',
          type: 'shell',
          command: 'uebuild',
          args: ['build', '--target', 'Editor', '--config', 'Development'],
          group: {
            kind: 'build',
            isDefault: true
          },
          problemMatcher: []
        },
        {
          label: 'Build Game (Development)',
          type: 'shell',
          command: 'uebuild',
          args: ['build', '--target', 'Game', '--config', 'Development'],
          group: 'build',
          problemMatcher: []
        },
        {
          label: 'Clean Build',
          type: 'shell',
          command: 'uebuild',
          args: ['build', '--target', 'Editor', '--config', 'Development', '--clean'],
          group: 'build',
          problemMatcher: []
        }
      ]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(tasksJson, null, 2)
    );

    // Create launch.json
    const launchJson = {
      version: '0.2.0',
      configurations: [
        {
          name: 'Launch Editor',
          type: 'cppvsdbg',
          request: 'launch',
          program: '${workspaceFolder}/Binaries/Win64/UnrealEditor.exe',
          args: ['"${workspaceFolder}/Project.uproject"'],
          cwd: '${workspaceFolder}',
          console: 'integratedTerminal',
          preLaunchTask: 'Build Editor (Development)'
        },
        {
          name: 'Launch Game',
          type: 'cppvsdbg',
          request: 'launch',
          program: '${workspaceFolder}/Binaries/Win64/Project.exe',
          cwd: '${workspaceFolder}',
          console: 'integratedTerminal',
          preLaunchTask: 'Build Game (Development)'
        }
      ]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'launch.json'),
      JSON.stringify(launchJson, null, 2)
    );

    // Create settings.json
    const settingsJson = {
      'files.exclude': {
        'Binaries': true,
        'Intermediate': true,
        'Saved': true,
        'DerivedDataCache': true,
        '**/.git': true,
        '**/.svn': true,
        '**/.hg': true,
        '**/CVS': true,
        '**/.DS_Store': true
      },
      'C_Cpp.default.configurationProvider': 'ms-vscode.cpptools',
      'cmake.configureOnOpen': false
    };

    await fs.writeFile(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settingsJson, null, 2)
    );

    // Create c_cpp_properties.json
    const cppProperties = {
      configurations: [
        {
          name: 'Win32',
          includePath: [
            '${workspaceFolder}/Source/**',
            '${workspaceFolder}/Intermediate/Build/Win64/**'
          ],
          defines: [
            'WIN32',
            '_WINDOWS',
            'UE_BUILD_DEVELOPMENT'
          ],
          windowsSdkVersion: '10.0',
          cStandard: 'c17',
          cppStandard: 'c++17',
          intelliSenseMode: 'windows-msvc-x64'
        }
      ],
      version: 4
    };

    await fs.writeFile(
      path.join(vscodeDir, 'c_cpp_properties.json'),
      JSON.stringify(cppProperties, null, 2)
    );

    Logger.success('VSCode configuration files generated');
  }

  /**
   * Find generated solution files
   */
  private static async findGeneratedSolutionFiles(projectPath: string): Promise<string[]> {
    const projectDir = path.dirname(projectPath);
    const solutionFiles: string[] = [];

    // Look for .sln files
    const slnFiles = await fs.readdir(projectDir).then(files =>
      files.filter(f => f.endsWith('.sln'))
    );

    solutionFiles.push(...slnFiles.map(f => path.join(projectDir, f)));

    // Look for project filter files
    const filterFiles = await fs.readdir(projectDir).then(files =>
      files.filter(f => f.endsWith('.vcxproj.filters'))
    );

    solutionFiles.push(...filterFiles.map(f => path.join(projectDir, f)));

    // Look for project files
    const vcxprojFiles = await fs.readdir(projectDir).then(files =>
      files.filter(f => f.endsWith('.vcxproj'))
    );

    solutionFiles.push(...vcxprojFiles.map(f => path.join(projectDir, f)));

    return solutionFiles;
  }

  /**
   * Find VSCode configuration files
   */
  private static async findVSCodeConfigFiles(projectPath: string): Promise<string[]> {
    const projectDir = path.dirname(projectPath);
    const vscodeDir = path.join(projectDir, '.vscode');

    if (!(await fs.pathExists(vscodeDir))) {
      return [];
    }

    const vscodeFiles = await fs.readdir(vscodeDir).then(files =>
      files.map(f => path.join(vscodeDir, f))
    );

    return vscodeFiles;
  }
}