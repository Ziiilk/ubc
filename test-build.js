const { BuildExecutor } = require('./dist/core/build-executor');
const path = require('path');

async function testBuild() {
  console.log('=== Testing BuildExecutor ===\n');

  const projectPath = 'E:\\WorkStation\\Proj1\\Proj1.uproject';
  console.log(`Project: ${projectPath}`);
  console.log(`Project exists: ${require('fs').existsSync(projectPath)}`);

  try {
    // 测试1：验证选项
    console.log('\n1. Testing validateOptions...');
    const options = {
      target: 'Editor',
      config: 'Development',
      platform: 'Win64',
      projectPath: projectPath,
      verbose: true
    };

    console.log('Input options:', JSON.stringify(options, null, 2));

    // 直接测试validateOptions（需要使其可访问）
    // 暂时跳过，直接测试execute

    // 测试2：执行构建（短时间超时）
    console.log('\n2. Testing build execution (with timeout)...');

    const buildOptions = {
      target: 'Editor',
      config: 'Development',
      platform: 'Win64',
      projectPath: projectPath,
      verbose: true
    };

    console.log('Starting build with options:', JSON.stringify(buildOptions, null, 2));

    // 设置超时，避免长时间运行
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Build timeout after 30 seconds')), 30000);
    });

    const buildPromise = BuildExecutor.execute(buildOptions);

    try {
      const result = await Promise.race([buildPromise, timeoutPromise]);
      console.log('\nBuild completed!');
      console.log('Success:', result.success);
      console.log('Exit code:', result.exitCode);
      console.log('Duration:', result.duration, 'ms');

      if (result.stdout) {
        console.log('\nSTDOUT (first 1000 chars):');
        console.log(result.stdout.substring(0, 1000));
      }

      if (result.stderr) {
        console.log('\nSTDERR (first 1000 chars):');
        console.log(result.stderr.substring(0, 1000));
      }

      if (result.error) {
        console.log('\nError:', result.error);
      }
    } catch (error) {
      console.log('\nBuild failed or timed out:');
      console.log('Error:', error.message);
      if (error.stack) {
        console.log('Stack:', error.stack);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// 运行测试
testBuild().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch(error => {
  console.error('\n=== Test failed ===');
  console.error(error);
  process.exit(1);
});