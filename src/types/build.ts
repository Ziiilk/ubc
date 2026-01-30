export type BuildTarget = 'Editor' | 'Game' | 'Client' | 'Server' | string;
export type BuildConfiguration = 'Debug' | 'DebugGame' | 'Development' | 'Shipping' | 'Test';
export type BuildPlatform = 'Win64' | 'Win32' | 'Linux' | 'Mac' | 'Android' | 'IOS';

export interface BuildOptions {
  target?: BuildTarget;
  config?: BuildConfiguration;
  platform?: BuildPlatform;
  projectPath?: string;
  enginePath?: string;
  clean?: boolean;
  verbose?: boolean;
  additionalArgs?: string[];
}

export interface BuildResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  error?: string;
}