/**
 * Core TypeScript interfaces and types for MegaLinter integration
 * Based on the architectural specification in MEGALINTER_ARCHITECTURE.md
 */

// Language and Framework Detection Types
export interface LanguageProfile {
  primary: string[];
  secondary: string[];
  frameworks: string[];
  buildTools: string[];
  configFiles: ConfigFileMap;
  complexity: 'simple' | 'moderate' | 'complex';
  confidence: number; // 0-1 confidence score
}

// Enhanced Language Profile with advanced detection capabilities
export interface EnhancedLanguageProfile extends LanguageProfile {
  // Language detection with confidence scores
  languageConfidence: Record<string, number>;
  dialectVersions: Record<string, string>;
  mixedLanguageBreakdown: Record<string, number>;
  domainSpecificLanguages: string[];
  
  // Enhanced framework detection
  frameworkVersions: Record<string, string>;
  architecturePatterns: string[];
  
  // Team analytics
  teamPreferences?: TeamPreferences;
  codeOwnership?: Record<string, string[]>;
  developerSpecialization?: Record<string, string[]>;
  
  // Historical analysis
  qualityTrends?: QualityTrend[];
  technicalDebtMetrics?: TechnicalDebtMetrics;
  
  // Organization insights
  crossRepoPatterns?: CrossRepositoryPatterns;
  standardsCompliance?: ComplianceMetrics;
}

// Team preferences and coding patterns
export interface TeamPreferences {
  indentationStyle: 'tabs' | 'spaces';
  indentSize: number;
  lineEndingStyle: 'LF' | 'CRLF';
  namingConventions: Record<string, string>;
  codeFormatting: Record<string, any>;
  preferredPatterns: string[];
  commitPatterns: CommitPattern[];
}

// Commit pattern analysis
export interface CommitPattern {
  author: string;
  frequency: number;
  timeOfDay: string[];
  filesModified: string[];
  linesChanged: number;
  commitMessageStyle: string;
}

// Historical quality trends
export interface QualityTrend {
  metric: string;
  values: {timestamp: Date, value: number}[];
  trend: 'improving' | 'stable' | 'declining';
}

// Technical debt metrics
export interface TechnicalDebtMetrics {
  overallDebtScore: number;
  debtByCategory: Record<string, number>;
  debtTrend: 'increasing' | 'stable' | 'decreasing';
  refactoringOpportunities: RefactoringOpportunity[];
  velocityImpact: number;
}

// Refactoring opportunity
export interface RefactoringOpportunity {
  id: string;
  path: string;
  type: 'duplication' | 'complexity' | 'legacy' | 'architecture';
  severity: 'high' | 'medium' | 'low';
  estimatedEffort: number;
  potentialImpact: number;
  description: string;
}

// Cross-repository patterns
export interface CrossRepositoryPatterns {
  sharedTechnologies: string[];
  consistencyScore: number;
  outlierRepositories: string[];
  bestPracticeAdoption: Record<string, number>;
  technologyDistribution: Record<string, number>;
}

// Compliance metrics
export interface ComplianceMetrics {
  overallCompliance: number;
  standardsAdoption: Record<string, number>;
  securityCompliance: number;
  accessibilityCompliance: number;
  performanceCompliance: number;
}

export interface ConfigFileMap {
  [key: string]: {
    path: string;
    type: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
  };
}

export interface RepositoryContext {
  rootPath: string;
  gitRemote?: string;
  organization?: string;
  repository?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'maven' | 'gradle' | 'pip' | 'cargo' | 'go';
  lastAnalyzed: Date;
}

// MegaLinter Configuration Types
export interface MegaLinterConfiguration {
  version: string;
  extends?: string[];
  linters: {
    enabled: LinterConfiguration[];
    disabled: string[];
    customRules: CustomRuleConfiguration[];
  };
  performance: PerformanceConfiguration;
  reporting: ReportingConfiguration;
  security: SecurityConfiguration;
}

export interface LinterConfiguration {
  name: string;
  version?: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  rules: Record<string, any>;
  filePatterns: string[];
  excludePatterns: string[];
  language: string;
  category: LinterCategory;
}

export interface CustomRuleConfiguration {
  name: string;
  path: string;
  type: 'eslint' | 'custom' | 'script';
  enabled: boolean;
}

export interface PerformanceConfiguration {
  maxExecutionTime: number;
  parallelism: number;
  resourceLimits: ResourceLimits;
  cacheStrategy: 'aggressive' | 'conservative' | 'disabled';
  incrementalScanning: boolean;
}

export interface ResourceLimits {
  maxMemory: string;
  maxCpuTime: number;
  maxFileSize: number;
  maxFilesPerLinter: number;
}

export interface ReportingConfiguration {
  formats: OutputFormat[];
  destinations: ReportDestination[];
  realTimeUpdates: boolean;
  includePassing: boolean;
}

export interface SecurityConfiguration {
  enableSecurityLinters: boolean;
  securitySeverityThreshold: 'low' | 'medium' | 'high' | 'critical';
  allowSecrets: boolean;
  trustedDirectories: string[];
}

// Execution and Results Types
export interface LintingResults {
  executionId: string;
  timestamp: Date;
  duration: number;
  repository: RepositoryContext;
  configuration: MegaLinterConfiguration;
  results: LinterResult[];
  summary: LintingSummary;
  performance: PerformanceMetrics;
}

export interface LinterResult {
  linter: string;
  version: string;
  status: 'success' | 'failure' | 'timeout' | 'skipped';
  duration: number;
  filesScanned: number;
  issues: LinterIssue[];
  errors: string[];
  warnings: string[];
}

export interface LinterIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
  linter: string;
  fixable: boolean;
  category: IssueCategory;
}

export interface LintingSummary {
  totalFiles: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  fixableCount: number;
  lintersExecuted: number;
  lintersSucceeded: number;
  lintersFailed: number;
}

export interface PerformanceMetrics {
  totalExecutionTime: number;
  linterExecutionTimes: Record<string, number>;
  memoryUsage: number;
  cpuUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

// Profiling performance metrics
export interface ProfilingPerformanceMetrics {
  operationName: string;
  executionTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
  incrementalUpdates: number;
}

// Profiling options
export interface ProfilingOptions {
  maxDepth?: number;
  maxFiles?: number;
  includeHistory?: boolean;
  includeTeamAnalysis?: boolean;
  includeMachineLearning?: boolean;
  cacheResults?: boolean;
  incrementalAnalysis?: boolean;
  timeoutMs?: number;
}

// Orchestrator Interface
export interface MegaLinterOrchestrator {
  detectLanguages(repositoryPath: string): Promise<LanguageProfile>;
  selectLinters(profile: LanguageProfile, preferences: UserPreferences): Promise<LinterConfiguration[]>;
  generateConfiguration(profile: LanguageProfile, linters: LinterConfiguration[]): Promise<MegaLinterConfiguration>;
  executeLinting(config: MegaLinterConfiguration, repositoryPath: string): Promise<LintingResults>;
  optimizePerformance(config: MegaLinterConfiguration): Promise<MegaLinterConfiguration>;
  validateConfiguration(config: MegaLinterConfiguration): Promise<ValidationResult>;
}

// Enhanced Orchestrator Interface
export interface EnhancedMegaLinterOrchestrator extends MegaLinterOrchestrator {
  detectLanguagesAdvanced(repositoryPath: string, options?: ProfilingOptions): Promise<EnhancedLanguageProfile>;
  detectFrameworksAdvanced(repositoryPath: string, languages: string[], options?: ProfilingOptions): Promise<any[]>;
  analyzeTeamPreferences(repositoryPath: string, options?: ProfilingOptions): Promise<TeamPreferences>;
  analyzeCodeHistory(repositoryPath: string, options?: ProfilingOptions): Promise<QualityTrend[]>;
  analyzeMultipleRepositories(repositoryPaths: string[], options?: ProfilingOptions): Promise<CrossRepositoryPatterns>;
  predictOptimalConfiguration(profile: EnhancedLanguageProfile): Promise<any>;
}

// Repository Profiler Interface
export interface RepositoryProfiler {
  analyzeRepository(repositoryPath: string): Promise<LanguageProfile>;
  detectLanguages(repositoryPath: string): Promise<string[]>;
  detectFrameworks(repositoryPath: string, languages: string[]): Promise<string[]>;
  detectBuildTools(repositoryPath: string): Promise<string[]>;
  analyzeComplexity(repositoryPath: string): Promise<'simple' | 'moderate' | 'complex'>;
  findConfigFiles(repositoryPath: string): Promise<ConfigFileMap>;
}

// Enhanced Repository Profiler Interface
export interface EnhancedRepositoryProfiler extends RepositoryProfiler {
  analyzeRepositoryAdvanced(repositoryPath: string, options?: ProfilingOptions): Promise<EnhancedLanguageProfile>;
  detectLanguagesAdvanced(repositoryPath: string, options?: ProfilingOptions): Promise<any[]>;
  detectFrameworksAdvanced(repositoryPath: string, languages: string[], options?: ProfilingOptions): Promise<any[]>;
  analyzeTeamPreferences(repositoryPath: string, options?: ProfilingOptions): Promise<TeamPreferences>;
  analyzeCodeHistory(repositoryPath: string, options?: ProfilingOptions): Promise<QualityTrend[]>;
  analyzeTechnicalDebt(repositoryPath: string, options?: ProfilingOptions): Promise<TechnicalDebtMetrics>;
  identifyRefactoringOpportunities(repositoryPath: string, options?: ProfilingOptions): Promise<RefactoringOpportunity[]>;
  getPerformanceMetrics(): ProfilingPerformanceMetrics;
}

// Configuration Generator Interface
export interface ConfigurationGenerator {
  generateConfiguration(profile: LanguageProfile, preferences: UserPreferences): Promise<MegaLinterConfiguration>;
  selectOptimalLinters(profile: LanguageProfile): Promise<LinterConfiguration[]>;
  generatePerformanceConfig(profile: LanguageProfile): Promise<PerformanceConfiguration>;
  generateReportingConfig(preferences: UserPreferences): Promise<ReportingConfiguration>;
  validateAndOptimize(config: MegaLinterConfiguration): Promise<MegaLinterConfiguration>;
}

// Enhanced Configuration Generator Interface
export interface EnhancedConfigurationGenerator extends ConfigurationGenerator {
  generateConfigurationAdvanced(profile: EnhancedLanguageProfile, preferences: UserPreferences): Promise<MegaLinterConfiguration>;
  selectOptimalLintersAdvanced(profile: EnhancedLanguageProfile): Promise<LinterConfiguration[]>;
  generatePerformanceConfigAdvanced(profile: EnhancedLanguageProfile): Promise<PerformanceConfiguration>;
  predictOptimalConfiguration(profile: EnhancedLanguageProfile): Promise<any>;
}

// User Preferences and Settings
export interface UserPreferences {
  preferredLinters?: string[];
  excludedLinters?: string[];
  severityThreshold: 'error' | 'warning' | 'info';
  performanceProfile: 'fast' | 'balanced' | 'thorough';
  reportingPreferences: ReportingPreferences;
  securityPreferences: SecurityPreferences;
  organizationStandards?: OrganizationStandards;
}

export interface ReportingPreferences {
  format: OutputFormat;
  includePassingFiles: boolean;
  detailLevel: 'minimal' | 'standard' | 'verbose';
  realTimeUpdates: boolean;
}

export interface SecurityPreferences {
  enableSecurityScanning: boolean;
  secretsDetection: boolean;
  vulnerabilityScanning: boolean;
  licenseChecking: boolean;
}

export interface OrganizationStandards {
  requiredLinters: string[];
  enforcedRules: Record<string, any>;
  allowedLicenses: string[];
  securityPolicies: SecurityPolicy[];
}

export interface SecurityPolicy {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enforcementLevel: 'warn' | 'error' | 'block';
}

// Enums and Constants
export enum LinterCategory {
  LANGUAGE = 'language',
  SECURITY = 'security',
  QUALITY = 'quality',
  FORMAT = 'format',
  DOCUMENTATION = 'documentation',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility'
}

export enum IssueCategory {
  BUG = 'bug',
  VULNERABILITY = 'vulnerability',
  CODE_SMELL = 'code_smell',
  STYLE = 'style',
  DOCUMENTATION = 'documentation',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability'
}

export enum OutputFormat {
  JSON = 'json',
  SARIF = 'sarif',
  JUNIT = 'junit',
  CONSOLE = 'console',
  HTML = 'html',
  MARKDOWN = 'markdown'
}

export enum ReportDestination {
  CONSOLE = 'console',
  FILE = 'file',
  VSCODE_PROBLEMS = 'vscode_problems',
  GITHUB_ANNOTATIONS = 'github_annotations',
  WEBHOOK = 'webhook'
}

// Validation and Error Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  field: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  suggestion?: string;
}

// Backward Compatibility Types
export interface TrustSignalsCompatibilityLayer {
  eslintConfigured: boolean;
  trunkConfigured: boolean; // maps to MegaLinter configuration status
  megalinterConfigured: boolean; // new field
  megalinterStatus: 'success' | 'failure' | 'pending' | 'unknown';
  linterCoverage: number; // percentage of recommended linters active
  performanceScore: number; // execution efficiency metric
  extensionsAligned: boolean;
  ciStatus: 'success' | 'failure' | 'pending' | 'unknown';
  securityScanStatus: 'clean' | 'issues' | 'unknown';
  lastUpdated: Date;
}

export interface DriftDetectionCompatibilityLayer {
  configDrift: string[];
  extensionDrift: string[];
  lintingDrift: string[]; // replaces lintingDrift with more granular info
  megalinterDrift: string[]; // new: MegaLinter-specific drift
  configurationDrift: string[]; // enhanced config drift detection
  performanceDrift: string[]; // new: performance regression detection
  hasAnyDrift: boolean;
}

// Docker Integration Types
export interface DockerConfiguration {
  image: string;
  tag: string;
  volumes: VolumeMount[];
  environment: Record<string, string>;
  networkMode?: string;
  workingDirectory: string;
  user?: string;
  memoryLimit?: string;
  cpuLimit?: number;
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readOnly: boolean;
}

// Event and Notification Types
export interface LintingEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  timestamp: Date;
  executionId: string;
  data?: any;
}

export interface ProgressUpdate {
  completedLinters: number;
  totalLinters: number;
  currentLinter: string;
  estimatedTimeRemaining: number;
}

// Utility Types
export type OptionalExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Default configurations and constants
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfiguration = {
  maxExecutionTime: 300000, // 5 minutes
  parallelism: 4,
  resourceLimits: {
    maxMemory: '2GB',
    maxCpuTime: 300,
    maxFileSize: 1048576, // 1MB
    maxFilesPerLinter: 10000
  },
  cacheStrategy: 'conservative',
  incrementalScanning: true
};

export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'scala',
  'html',
  'css',
  'scss',
  'less',
  'json',
  'yaml',
  'xml',
  'markdown',
  'dockerfile',
  'shell',
  'powershell'
] as const;

export const FRAMEWORK_PATTERNS: Record<string, string[]> = {
  'react': ['package.json:react', 'jsx', 'tsx'],
  'angular': ['package.json:@angular/core', 'angular.json'],
  'vue': ['package.json:vue', 'vue'],
  'svelte': ['package.json:svelte', 'svelte'],
  'next': ['package.json:next', 'next.config.js'],
  'nuxt': ['package.json:nuxt', 'nuxt.config.js'],
  'express': ['package.json:express'],
  'fastify': ['package.json:fastify'],
  'django': ['requirements.txt:Django', 'manage.py'],
  'flask': ['requirements.txt:Flask'],
  'spring': ['pom.xml:spring', 'build.gradle:spring'],
  'laravel': ['composer.json:laravel'],
  'rails': ['Gemfile:rails']
};