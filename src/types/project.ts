export interface UProject {
  FileVersion: number;
  EngineAssociation: string; // GUID or string like "5.1"
  Category?: string;
  Description?: string;
  Modules: Array<{
    Name: string;
    Type: 'Runtime' | 'Editor' | 'Developer' | 'Program' | 'Server';
    LoadingPhase: 'Default' | 'PostConfigInit' | 'PreDefault' | string;
  }>;
  Plugins?: Array<{
    Name: string;
    Enabled: boolean;
    TargetAllowList?: string[];
  }>;
}

export interface ProjectInfo {
  name: string;
  path: string;
  uproject: UProject;
  sourceDir: string;
  targets: Array<{
    name: string;
    type: 'Editor' | 'Game' | 'Client' | 'Server';
    path: string;
  }>;
  modules: Array<{
    name: string;
    path: string;
  }>;
}

export interface ProjectDetectionOptions {
  cwd?: string;
  recursive?: boolean;
}

export interface ProjectDetectionResult {
  isValid: boolean;
  project?: ProjectInfo;
  error?: string;
  warnings: string[];
}