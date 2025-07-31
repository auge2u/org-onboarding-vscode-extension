/**
 * Advanced Repository Profiling - Core Types and Interfaces
 * Defines the data structures and interfaces for enhanced repository profiling
 */

import { LanguageProfile, ConfigFileMap } from '../megalinter/types';

/**
 * Enhanced language profile with advanced detection capabilities
 */
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

/**
 * Team preferences and coding patterns
 */
export interface TeamPreferences {
  indentationStyle: 'tabs' | 'spaces';
  indentSize: number;
  lineEndingStyle: 'LF' | 'CRLF';
  namingConventions: Record<string, string>;
  codeFormatting: Record<string, any>;
  preferredPatterns: string[];
  commitPatterns: CommitPattern[];
}

/**
 * Commit pattern analysis
 */
export interface CommitPattern {
  author: string;
  frequency: number;
  timeOfDay: string;
  filesModified: string[];
  linesChanged: number;
  commitMessageStyle: string;
}

/**
 * Historical quality trends
 */
export interface QualityTrend {
  metric: string;
  values: {timestamp: Date, value: number}[];
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Technical debt metrics
 */
export interface TechnicalDebtMetrics {
  overallDebtScore: number;
  debtByCategory: Record<string, number>;
  debtTrend: 'increasing' | 'stable' | 'decreasing';
  refactoringOpportunities: RefactoringOpportunity[];
  velocityImpact: number;
}

/**
 * Refactoring opportunity
 */
export interface RefactoringOpportunity {
  id: string;
  path: string;
  type: 'duplication' | 'complexity' | 'legacy' | 'architecture';
  severity: 'high' | 'medium' | 'low';
  estimatedEffort: number;
  potentialImpact: number;
  description: string;
}

/**
 * Cross-repository patterns
 */
export interface CrossRepositoryPatterns {
  sharedTechnologies: string[];
  consistencyScore: number;
  outlierRepositories: string[];
  bestPracticeAdoption: Record<string, number>;
  technologyDistribution: Record<string, number>;
}

/**
 * Compliance metrics
 */
export interface ComplianceMetrics {
  overallCompliance: number;
  standardsAdoption: Record<string, number>;
  securityCompliance: number;
  accessibilityCompliance: number;
  performanceCompliance: number;
}

/**
 * Language detection result with confidence scoring
 */
export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  dialect?: string;
  version?: string;
  files: number;
  lines: number;
  percentage: number;
}

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  name: string;
  version?: string;
  confidence: number;
  usage: 'primary' | 'secondary' | 'minimal' | 'architecture';
  dependencies: string[];
  files: string[];
}

/**
 * Architecture pattern detection
 */
export interface ArchitecturePatternResult {
  pattern: string;
  confidence: number;
  locations: string[];
  description: string;
}

/**
 * Git history analysis result
 */
export interface GitHistoryAnalysisResult {
  totalCommits: number;
  authors: AuthorActivity[];
  commitFrequency: Record<string, number>;
  fileChurn: Record<string, number>;
  codeOwnership: Record<string, string[]>;
  timeSpan: {
    firstCommit: Date;
    lastCommit: Date;
  };
}

/**
 * Author activity analysis
 */
export interface AuthorActivity {
  name: string;
  email: string;
  commits: number;
  filesModified: string[];
  linesAdded: number;
  linesRemoved: number;
  activeTimeSpan: {
    first: Date;
    last: Date;
  };
  commitPattern: {
    dayOfWeek: Record<string, number>;
    timeOfDay: Record<string, number>;
  };
}

/**
 * Machine learning prediction result
 */
export interface MLPredictionResult {
  configurationSuggestions: Record<string, any>;
  confidence: number;
  reasoning: string[];
  alternativeSuggestions?: Record<string, any>[];
}

/**
 * Base interface for all specialized analyzers
 */
export interface Analyzer<T> {
  analyze(repositoryPath: string, options?: any): Promise<T>;
  getCapabilities(): string[];
  isAvailable(): Promise<boolean>;
}

/**
 * Language detector interface
 */
export interface LanguageDetector extends Analyzer<LanguageDetectionResult[]> {
  detectLanguage(filePath: string): Promise<LanguageDetectionResult | null>;
  detectDialect(language: string, filePath: string): Promise<string | null>;
  detectVersion(language: string, filePath: string): Promise<string | null>;
  calculateConfidence(language: string, filePath: string): Promise<number>;
}

/**
 * Framework analyzer interface
 */
export interface FrameworkAnalyzer extends Analyzer<FrameworkDetectionResult[]> {
  detectFrameworks(languages: string[], packageFiles: string[]): Promise<FrameworkDetectionResult[]>;
  detectVersion(framework: string, packageFiles: string[]): Promise<string | null>;
  detectArchitecturePatterns(repositoryPath: string): Promise<ArchitecturePatternResult[]>;
}

/**
 * Team analytics interface
 */
export interface TeamAnalytics extends Analyzer<TeamPreferences> {
  analyzeGitHistory(repositoryPath: string): Promise<GitHistoryAnalysisResult>;
  detectCodingPreferences(repositoryPath: string): Promise<TeamPreferences>;
  mapCodeOwnership(repositoryPath: string): Promise<Record<string, string[]>>;
  identifySpecializations(repositoryPath: string): Promise<Record<string, string[]>>;
}

/**
 * History analyzer interface
 */
export interface HistoryAnalyzer extends Analyzer<QualityTrend[]> {
  analyzeQualityTrends(repositoryPath: string): Promise<QualityTrend[]>;
  analyzeTechnicalDebt(repositoryPath: string): Promise<TechnicalDebtMetrics>;
  identifyRefactoringOpportunities(repositoryPath: string): Promise<RefactoringOpportunity[]>;
  trackVelocity(repositoryPath: string): Promise<number>;
}

/**
 * Organization profiler interface
 */
export interface OrganizationProfiler extends Analyzer<CrossRepositoryPatterns> {
  analyzeMultipleRepositories(repositoryPaths: string[]): Promise<CrossRepositoryPatterns>;
  compareStandardsCompliance(repositoryPaths: string[]): Promise<ComplianceMetrics>;
  identifyBestPractices(repositoryPaths: string[]): Promise<Record<string, number>>;
  visualizeTechnologyStack(repositoryPaths: string[]): Promise<Record<string, number>>;
}

/**
 * Machine learning predictor interface
 */
export interface MLPredictor extends Analyzer<MLPredictionResult> {
  predictOptimalConfiguration(profile: EnhancedLanguageProfile): Promise<MLPredictionResult>;
  identifyPatterns(repositoryPath: string): Promise<Record<string, any>>;
  detectAnomalies(repositoryPath: string): Promise<Record<string, any>>;
  trainModel(trainingData: any[]): Promise<void>;
}

/**
 * Performance metrics for profiling operations
 */
export interface ProfilingPerformanceMetrics {
  operationName: string;
  executionTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
  incrementalUpdates: number;
}

/**
 * Profiling options
 */
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