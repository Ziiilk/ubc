export type IDE = 'sln' | 'vscode' | 'clion' | 'xcode' | 'vs2022';

export interface GenerateOptions {
  ide?: IDE;
  projectPath?: string;
  enginePath?: string;
  force?: boolean;
}

export interface GenerateResult {
  success: boolean;
  generatedFiles: string[];
  error?: string;
}