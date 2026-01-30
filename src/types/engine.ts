export interface EngineVersionInfo {
  MajorVersion: number;
  MinorVersion: number;
  PatchVersion: number;
  Changelist: number;
  CompatibleChangelist: number;
  IsLicenseeVersion: number;
  IsPromotedBuild: number;
  BranchName: string;
  BuildId: string;
}

export interface EngineInstallation {
  path: string;
  version?: EngineVersionInfo;
  associationId: string; // GUID
  displayName?: string;
  installedDate?: string;
}

export interface EngineAssociation {
  guid: string;
  name?: string;
  path?: string;
  version?: string;
}

export interface EngineDetectionResult {
  engine?: EngineInstallation;
  uprojectEngine?: EngineAssociation;
  error?: string;
  warnings: string[];
}