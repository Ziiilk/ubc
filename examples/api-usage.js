// Example: Programmatic usage of uebuild API
const { UEBuildAPI } = require('../dist/index');

async function main() {
  console.log('=== UEBuild API Example ===\n');

  try {
    // 1. Detect project in current directory
    console.log('1. Detecting project...');
    const detectionResult = await UEBuildAPI.project.detect();

    if (detectionResult.isValid && detectionResult.project) {
      console.log(`   Found project: ${detectionResult.project.name}`);
      console.log(`   Engine association: ${detectionResult.project.uproject.EngineAssociation}`);
    } else {
      console.log(`   Error: ${detectionResult.error || 'No project found'}`);
    }

    // 2. Resolve engine information
    console.log('\n2. Resolving engine...');
    const engineResult = await UEBuildAPI.engine.resolve();

    if (engineResult.engine) {
      console.log(`   Engine: ${engineResult.engine.displayName || engineResult.engine.associationId}`);
      if (engineResult.engine.version) {
        console.log(`   Version: ${engineResult.engine.version.MajorVersion}.${engineResult.engine.version.MinorVersion}.${engineResult.engine.version.PatchVersion}`);
      }
    } else {
      console.log(`   Warning: ${engineResult.error || 'No engine found'}`);
    }

    // 3. Get available build targets
    console.log('\n3. Getting build targets...');
    const targets = await UEBuildAPI.build.getAvailableTargets(process.cwd());
    console.log(`   Available targets: ${targets.map(t => t.name).join(', ') || 'None'}`);

    // 4. Example: Build with specific options
    console.log('\n4. Example build configuration:');
    const buildOptions = {
      target: 'Editor',
      config: 'Development',
      platform: 'Win64',
      verbose: false
    };
    console.log(`   Target: ${buildOptions.target}`);
    console.log(`   Config: ${buildOptions.config}`);
    console.log(`   Platform: ${buildOptions.platform}`);

    // Note: Uncomment to actually execute build (requires engine path)
    // const buildResult = await UEBuildAPI.build.execute(buildOptions);
    // console.log(`Build result: ${buildResult.success ? 'Success' : 'Failed'}`);

    // 5. Example: Initialize new project
    console.log('\n5. Example project initialization:');
    const initOptions = {
      name: 'MyNewProject',
      type: 'cpp',
      directory: './test-project'
    };
    console.log(`   Would create: ${initOptions.name} (${initOptions.type}) at ${initOptions.directory}`);

    // Note: Uncomment to actually create project
    // const initResult = await UEBuildAPI.init.initialize(initOptions);
    // console.log(`Init result: ${initResult.success ? 'Success' : 'Failed'}`);

    console.log('\n=== Example complete ===');
    console.log('\nFor full functionality:');
    console.log('1. Install uebuild globally: npm install -g uebuild');
    console.log('2. Use CLI: uebuild --help');
    console.log('3. Or use API as shown above');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };