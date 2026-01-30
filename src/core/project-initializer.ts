import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { InitOptions, InitResult, ProjectType } from '../types/init';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { EngineResolver } from './engine-resolver';

export class ProjectInitializer {
  /**
   * Initialize a new Unreal Engine project
   */
  static async initialize(options: InitOptions): Promise<InitResult> {
    const createdFiles: string[] = [];

    try {
      // Validate options
      const validatedOptions = await this.validateOptions(options);
      const { name, type, directory, enginePath, force } = validatedOptions;

      Logger.title(`Initializing ${name}`);

      // Create project directory
      await fs.ensureDir(directory);

      // Check if directory is safe for initialization
      const safetyCheck = await Validator.isSafeForInit(directory, force);
      if (!safetyCheck.safe) {
        throw new Error(`Directory not safe for initialization: ${safetyCheck.message}`);
      }

      Logger.info(`Project directory: ${directory}`);
      Logger.info(`Project type: ${type}`);
      Logger.info(`Engine: ${enginePath}`);

      // Create project structure based on type
      switch (type) {
        case 'cpp':
          await this.createCppProject(name, directory, enginePath);
          break;
        case 'blueprint':
          await this.createBlueprintProject(name, directory, enginePath);
          break;
        case 'blank':
          await this.createBlankProject(name, directory, enginePath);
          break;
      }

      // Create .uproject file
      const uprojectPath = await this.createUProjectFile(name, directory, enginePath, type);
      createdFiles.push(uprojectPath);

      // Create source directory and files for C++ projects
      if (type === 'cpp') {
        const sourceFiles = await this.createSourceFiles(name, directory, enginePath);
        createdFiles.push(...sourceFiles);
      }

      // Create Content directory for blueprint projects
      if (type === 'blueprint' || type === 'blank') {
        const contentDir = path.join(directory, 'Content');
        await fs.ensureDir(contentDir);
        createdFiles.push(contentDir);
      }

      // Create Config directory
      const configDir = path.join(directory, 'Config');
      await fs.ensureDir(configDir);
      createdFiles.push(configDir);

      // Create default config files
      await this.createConfigFiles(directory);
      createdFiles.push(path.join(configDir, 'DefaultEngine.ini'));

      Logger.success(`Project ${name} initialized successfully`);

      return {
        success: true,
        projectPath: directory,
        uprojectPath,
        engineAssociation: await this.getEngineAssociationId(enginePath),
        createdFiles
      };

    } catch (error) {
      return {
        success: false,
        projectPath: options.directory || '',
        uprojectPath: '',
        engineAssociation: '',
        createdFiles,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate and complete initialization options
   */
  private static async validateOptions(options: InitOptions): Promise<Required<InitOptions>> {
    const name = options.name;
    if (!name) {
      throw new Error('Project name is required');
    }

    if (!Validator.isValidProjectName(name)) {
      throw new Error('Project name can only contain alphanumeric characters, underscores, and hyphens');
    }

    const type: ProjectType = options.type || 'cpp';
    if (!Validator.isValidProjectType(type)) {
      throw new Error(`Invalid project type: ${type}`);
    }

    const directory = options.directory || path.join(process.cwd(), name);
    const template = options.template || 'Basic';

    // Resolve engine path
    let enginePath = options.enginePath;
    if (!enginePath) {
      // Find available engines
      const engines = await EngineResolver.findEngineInstallations();

      if (engines.length === 0) {
        throw new Error('No Unreal Engine installations found. Please specify --engine-path');
      } else if (engines.length === 1) {
        enginePath = engines[0].path;
        Logger.info(`Using engine: ${engines[0].displayName || engines[0].associationId}`);
      } else {
        // Multiple engines - let user choose
        enginePath = await this.promptForEngineSelection(engines);
      }
    }

    // Validate engine path
    if (!(await Validator.isValidEnginePath(enginePath))) {
      throw new Error(`Invalid engine path: ${enginePath}. Make sure it points to a valid Unreal Engine installation.`);
    }

    const force = options.force || false;

    return {
      name,
      type,
      template,
      enginePath,
      directory,
      force
    };
  }

  /**
   * Prompt user to select an engine from multiple installations
   */
  private static async promptForEngineSelection(engines: any[]): Promise<string> {
    Logger.info('Multiple Unreal Engine installations found:');

    const choices = engines.map((engine, _index) => {
      let description = engine.path;
      if (engine.version) {
        description += ` (UE ${engine.version.MajorVersion}.${engine.version.MinorVersion}.${engine.version.PatchVersion})`;
      }
      if (engine.displayName) {
        description = `${engine.displayName} - ${description}`;
      }
      return {
        name: description,
        value: engine.path
      };
    });

    const { selectedEngine } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedEngine',
        message: 'Select engine to use:',
        choices
      }
    ]);

    return selectedEngine;
  }

  /**
   * Create C++ project structure
   */
  private static async createCppProject(name: string, directory: string, _enginePath: string): Promise<void> {
    // Create Source directory
    const sourceDir = path.join(directory, 'Source');
    await fs.ensureDir(sourceDir);

    // Create project module directory
    const moduleDir = path.join(sourceDir, name);
    await fs.ensureDir(moduleDir);

    // Create Public and Private directories
    await fs.ensureDir(path.join(moduleDir, 'Public'));
    await fs.ensureDir(path.join(moduleDir, 'Private'));
  }

  /**
   * Create Blueprint project structure
   */
  private static async createBlueprintProject(_name: string, directory: string, _enginePath: string): Promise<void> {
    // Blueprint projects only need Content directory
    const contentDir = path.join(directory, 'Content');
    await fs.ensureDir(contentDir);
  }

  /**
   * Create Blank project structure
   */
  private static async createBlankProject(_name: string, directory: string, _enginePath: string): Promise<void> {
    // Blank project has minimal structure
    const contentDir = path.join(directory, 'Content');
    await fs.ensureDir(contentDir);
  }

  /**
   * Create .uproject file
   */
  private static async createUProjectFile(
    name: string,
    directory: string,
    enginePath: string,
    type: ProjectType
  ): Promise<string> {
    const uprojectPath = path.join(directory, `${name}.uproject`);

    const engineAssociation = await this.getEngineAssociationId(enginePath);

    const uproject = {
      FileVersion: 3,
      EngineAssociation: engineAssociation,
      Category: '',
      Description: '',
      Modules: type === 'cpp' ? [
        {
          Name: name,
          Type: 'Runtime',
          LoadingPhase: 'Default'
        }
      ] : [],
      Plugins: [],
      TargetPlatforms: []
    };

    await fs.writeFile(uprojectPath, JSON.stringify(uproject, null, 2), 'utf-8');
    return uprojectPath;
  }

  /**
   * Get engine association ID from engine path
   */
  private static async getEngineAssociationId(enginePath: string): Promise<string> {
    // First, try to get from registry
    const engines = await EngineResolver.findEngineInstallations();
    const matchingEngine = engines.find(engine => engine.path === enginePath);

    if (matchingEngine && matchingEngine.associationId) {
      return matchingEngine.associationId;
    }

    // Fallback: try to extract from version file
    try {
      const versionFile = path.join(enginePath, 'Engine', 'Build', 'Build.version');
      if (await fs.pathExists(versionFile)) {
        const content = await fs.readFile(versionFile, 'utf-8');
        const versionInfo = JSON.parse(content);
        return `{${versionInfo.MajorVersion}.${versionInfo.MinorVersion}.${versionInfo.PatchVersion}}`;
      }
    } catch {
      // ignore
    }

    // Final fallback: use generic ID
    return '5.1';
  }

  /**
   * Create source files for C++ project
   */
  private static async createSourceFiles(
    name: string,
    directory: string,
    _enginePath: string
  ): Promise<string[]> {
    const createdFiles: string[] = [];
    const sourceDir = path.join(directory, 'Source');

    // Create .Target.cs files
    const gameTarget = await this.createTargetFile(name, sourceDir, 'Game');
    const editorTarget = await this.createTargetFile(name, sourceDir, 'Editor');
    createdFiles.push(gameTarget, editorTarget);

    // Create .Build.cs file
    const buildCs = await this.createBuildCsFile(name, sourceDir);
    createdFiles.push(buildCs);

    // Create main module files
    const moduleDir = path.join(sourceDir, name);
    const publicDir = path.join(moduleDir, 'Public');
    const privateDir = path.join(moduleDir, 'Private');

    // Create module header
    const moduleHeader = await this.createModuleHeader(name, publicDir);
    createdFiles.push(moduleHeader);

    // Create module source
    const moduleSource = await this.createModuleSource(name, privateDir);
    createdFiles.push(moduleSource);

    // Create game mode header (example)
    const gameModeHeader = await this.createGameModeHeader(name, publicDir);
    createdFiles.push(gameModeHeader);

    // Create game mode source
    const gameModeSource = await this.createGameModeSource(name, privateDir);
    createdFiles.push(gameModeSource);

    return createdFiles;
  }

  /**
   * Create target file (*.Target.cs)
   */
  private static async createTargetFile(
    name: string,
    sourceDir: string,
    type: 'Game' | 'Editor'
  ): Promise<string> {
    const fileName = type === 'Editor' ? `${name}Editor.Target.cs` : `${name}.Target.cs`;
    const filePath = path.join(sourceDir, fileName);

    const targetType = type === 'Editor' ? 'TargetType.Editor' : 'TargetType.Game';
    const extraModuleNames = type === 'Editor' ? `"${name}"` : '';

    const content = `using UnrealBuildTool;
using System.Collections.Generic;

public class ${name}${type === 'Editor' ? 'Editor' : ''}Target : TargetRules
{
    public ${name}${type === 'Editor' ? 'Editor' : ''}Target(TargetInfo Target) : base(Target)
    {
        Type = ${targetType};
        DefaultBuildSettings = BuildSettingsVersion.V2;
        ${extraModuleNames ? `ExtraModuleNames.AddRange(new string[] { ${extraModuleNames} });` : ''}
    }
}`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create build file (*.Build.cs)
   */
  private static async createBuildCsFile(name: string, sourceDir: string): Promise<string> {
    const filePath = path.join(sourceDir, name, `${name}.Build.cs`);

    const content = `using UnrealBuildTool;

public class ${name} : ModuleRules
{
    public ${name}(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[] {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore"
        });

        PrivateDependencyModuleNames.AddRange(new string[] {
            // Add private dependencies here
        });
    }
}`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create module header file
   */
  private static async createModuleHeader(name: string, publicDir: string): Promise<string> {
    const filePath = path.join(publicDir, `${name}.h`);

    const content = `#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

class F${name}Module : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
};`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create module source file
   */
  private static async createModuleSource(name: string, privateDir: string): Promise<string> {
    const filePath = path.join(privateDir, `${name}.cpp`);

    const content = `#include "${name}.h"
#include "Modules/ModuleManager.h"

IMPLEMENT_MODULE(F${name}Module, ${name})

void F${name}Module::StartupModule()
{
    // Startup code here
}

void F${name}Module::ShutdownModule()
{
    // Shutdown code here
}`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create game mode header file
   */
  private static async createGameModeHeader(name: string, publicDir: string): Promise<string> {
    const filePath = path.join(publicDir, `${name}GameModeBase.h`);

    const content = `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "${name}GameModeBase.generated.h"

UCLASS()
class A${name}GameModeBase : public AGameModeBase
{
    GENERATED_BODY()

public:
    A${name}GameModeBase();
};`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create game mode source file
   */
  private static async createGameModeSource(name: string, privateDir: string): Promise<string> {
    const filePath = path.join(privateDir, `${name}GameModeBase.cpp`);

    const content = `#include "${name}GameModeBase.h"

A${name}GameModeBase::A${name}GameModeBase()
{
    // Set default pawn class
    static ConstructorHelpers::FClassFinder<APawn> PlayerPawnBPClass(TEXT("/Game/ThirdPerson/Blueprints/BP_ThirdPersonCharacter"));
    if (PlayerPawnBPClass.Class != nullptr)
    {
        DefaultPawnClass = PlayerPawnBPClass.Class;
    }
}`;

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Create config files
   */
  private static async createConfigFiles(directory: string): Promise<void> {
    const configDir = path.join(directory, 'Config');

    // Create DefaultEngine.ini
    const defaultEngineContent = `[/Script/EngineSettings.GeneralProjectSettings]
ProjectID=00000000000000000000000000000000

[/Script/Engine.Engine]
+ActiveGameNameRedirects=(OldGameName="/Script/Engine",NewGameName="/Script/Engine")
+ActiveGameNameRedirects=(OldGameName="/Script/CoreUObject",NewGameName="/Script/CoreUObject")
`;
    await fs.writeFile(path.join(configDir, 'DefaultEngine.ini'), defaultEngineContent, 'utf-8');

    // Create DefaultGame.ini
    const defaultGameContent = `[/Script/Engine.GameSession]
`;
    await fs.writeFile(path.join(configDir, 'DefaultGame.ini'), defaultGameContent, 'utf-8');

    // Create DefaultEditor.ini
    const defaultEditorContent = `[/Script/UnrealEd.EditorEngine]
+ActiveGameNameRedirects=(OldGameName="/Script/Engine",NewGameName="/Script/Engine")
+ActiveGameNameRedirects=(OldGameName="/Script/CoreUObject",NewGameName="/Script/CoreUObject")
`;
    await fs.writeFile(path.join(configDir, 'DefaultEditor.ini'), defaultEditorContent, 'utf-8');
  }
}