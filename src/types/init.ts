export type ProjectType = 'cpp' | 'blueprint' | 'blank';

export interface InitOptions {
  name: string;
  type?: ProjectType;
  template?: string;
  enginePath?: string;
  directory?: string;
  force?: boolean;
}

export interface InitResult {
  success: boolean;
  projectPath: string;
  uprojectPath: string;
  engineAssociation: string;
  createdFiles: string[];
  error?: string;
}