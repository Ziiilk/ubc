# uebuild

Unreal Engine project management CLI tool for Agent integration.

## Features

- **Project Detection** (`uebuild list`): Detect and analyze Unreal Engine projects
- **Engine Information** (`uebuild engine`): Resolve engine associations and versions
- **Build Execution** (`uebuild build`): Build projects with various configurations
- **Project Generation** (`uebuild generate`): Generate IDE project files (Visual Studio, VSCode, etc.)
- **Project Initialization** (`uebuild init`): Create new Unreal Engine projects (C++ or Blueprint)

## Installation

```bash
# Global installation
npm install -g uebuild

# Or as project dependency
npm install uebuild --save-dev
```

## Usage

### CLI Commands

```bash
# Detect project in current directory
uebuild list
uebuild ls

# Show engine information
uebuild engine

# Build project (default: Editor, Development, Win64)
uebuild build
uebuild build --target Game --config Shipping
uebuild build --platform Linux --verbose

# Generate IDE project files
uebuild generate
uebuild generate --ide vscode

# Initialize new project
uebuild init --name MyProject --type cpp
uebuild init --name MyBlueprintProject --type blueprint
```

### Programmatic API

```javascript
import UEBuildAPI from 'uebuild';

// Detect project
const project = await UEBuildAPI.project.detect();

// Resolve engine
const engine = await UEBuildAPI.engine.resolve();

// Build project
const buildResult = await UEBuildAPI.build.execute({
  target: 'Editor',
  config: 'Development',
  platform: 'Win64'
});

// Generate project files
const genResult = await UEBuildAPI.generate.generate({
  ide: 'vscode'
});

// Initialize new project
const initResult = await UEBuildAPI.init.initialize({
  name: 'MyProject',
  type: 'cpp'
});
```

## Command Reference

### `uebuild list` / `uebuild ls`
Detect Unreal Engine project in current directory.

Options:
- `-r, --recursive`: Search recursively for .uproject files
- `-j, --json`: Output result as JSON

### `uebuild engine`
Display engine information for the current project.

Options:
- `-p, --project <path>`: Path to project directory or .uproject file
- `-j, --json`: Output result as JSON

### `uebuild build`
Build Unreal Engine project.

Options:
- `-t, --target <target>`: Build target (Editor, Game, Client, Server) - default: Editor
- `-c, --config <config>`: Build configuration (Debug, DebugGame, Development, Shipping, Test) - default: Development
- `-p, --platform <platform>`: Build platform (Win64, Win32, Linux, Mac, Android, IOS) - default: Win64
- `--project <path>`: Path to project directory or .uproject file
- `--engine-path <path>`: Path to Unreal Engine installation
- `--clean`: Clean build (rebuild everything)
- `--verbose`: Verbose output
- `--dry-run`: Show what would be built without actually building
- `--list-targets`: List available build targets for project

### `uebuild generate` / `uebuild gen`
Generate IDE project files.

Options:
- `-i, --ide <ide>`: IDE type (sln, vscode, clion, xcode, vs2022) - default: sln
- `--project <path>`: Path to project directory or .uproject file
- `--engine-path <path>`: Path to Unreal Engine installation
- `--force`: Force regeneration of project files
- `--list-ides`: List available IDE types

### `uebuild init`
Initialize a new Unreal Engine project.

Options:
- `-n, --name <name>`: Project name (alphanumeric, underscores, hyphens) - required
- `-t, --type <type>`: Project type (cpp, blueprint, blank) - default: cpp
- `--template <template>`: Project template (Basic, FirstPerson, ThirdPerson, etc.) - default: Basic
- `-d, --directory <path>`: Directory to create project in (default: ./<name>)
- `--engine-path <path>`: Path to Unreal Engine installation
- `--force`: Force initialization even if directory is not empty
- `--dry-run`: Show what would be created without actually creating

## Engine Detection

The tool automatically detects Unreal Engine installations using:

1. **Windows Registry**: `HKEY_CURRENT_USER\SOFTWARE\Epic Games\Unreal Engine\Builds`
2. **Launcher Installation**: `%LOCALAPPDATA%\UnrealEngine\Common\LauncherInstalled.dat`
3. **Environment Variables**: `UE_ENGINE_PATH`, `UE_ROOT`, `UNREAL_ENGINE_PATH`
4. **Manual Specification**: `--engine-path` option

When multiple engines are found, the tool will prompt for selection during initialization.

## Development

```bash
# Clone repository
git clone <repository-url>
cd uebuild

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT