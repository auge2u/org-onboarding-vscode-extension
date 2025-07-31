/**
 * Organization Profiler
 * Enables multi-repository analysis and comparison, detecting cross-repository patterns and standards compliance
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OrganizationProfiler, CrossRepositoryPatterns, ComplianceMetrics, ProfilingOptions, ProfilingPerformanceMetrics } from './types';
import { AdvancedLanguageDetector } from './languageDetector';
import { AdvancedFrameworkAnalyzer } from './frameworkAnalyzer';
import { AdvancedTeamAnalytics } from './teamAnalytics';
import { AdvancedHistoryAnalyzer } from './historyAnalyzer';

/**
 * Organization profiler implementation
 */
export class AdvancedOrganizationProfiler implements OrganizationProfiler {
  private readonly languageDetector: AdvancedLanguageDetector;
  private readonly frameworkAnalyzer: AdvancedFrameworkAnalyzer;
  private readonly teamAnalytics: AdvancedTeamAnalytics;
  private readonly historyAnalyzer: AdvancedHistoryAnalyzer;
  private readonly resultCache: Map<string, CrossRepositoryPatterns> = new Map();
  private readonly maxCacheSize = 10;
  private performanceMetrics: ProfilingPerformanceMetrics;

  constructor() {
    this.languageDetector = new AdvancedLanguageDetector();
    this.frameworkAnalyzer = new AdvancedFrameworkAnalyzer();
    this.teamAnalytics = new AdvancedTeamAnalytics();
    this.historyAnalyzer = new AdvancedHistoryAnalyzer();
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Analyze multiple repositories to detect cross-repository patterns
   */
  async analyze(repositoryPath: string, options?: ProfilingOptions): Promise<CrossRepositoryPatterns> {
    const startTime = Date.now();
    const cacheResults = options?.cacheResults !== false;
    const timeoutMs = options?.timeoutMs || 120000; // Multi-repo analysis can take longer

    // Reset performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.performanceMetrics.operationName = 'organization-analysis';

    try {
      // Check cache first
      if (cacheResults && this.resultCache.has(repositoryPath)) {
        this.performanceMetrics.cacheHits++;
        return this.resultCache.get(repositoryPath)!;
      }
      this.performanceMetrics.cacheMisses++;

      // Find all repositories in the organization
      const repositoryPaths = await this.findRepositories(repositoryPath);
      
      if (repositoryPaths.length === 0) {
        throw new Error('No repositories found');
      }
      
      // Analyze multiple repositories
      const result = await this.analyzeMultipleRepositories(repositoryPaths);
      
      // Cache results
      if (cacheResults) {
        if (this.resultCache.size >= this.maxCacheSize) {
          const oldestKey = this.resultCache.keys().next().value;
          if (oldestKey) {
            this.resultCache.delete(oldestKey);
          }
        }
        this.resultCache.set(repositoryPath, result);
      }

      // Update performance metrics
      this.performanceMetrics.executionTime = Date.now() - startTime;
      
      return result;
    } catch (error) {
      console.error('Error in organization analysis:', error);
      throw new Error(`Organization analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze multiple repositories to detect cross-repository patterns
   */
  async analyzeMultipleRepositories(repositoryPaths: string[]): Promise<CrossRepositoryPatterns> {
    try {
      // Analyze each repository
      const repositoryProfiles = await Promise.all(
        repositoryPaths.map(async (repoPath) => {
          try {
            // Detect languages
            const languages = await this.languageDetector.analyze(repoPath);
            
            // Detect frameworks
            const frameworks = await this.frameworkAnalyzer.analyze(repoPath);
            
            // Analyze team preferences
            const teamPreferences = await this.teamAnalytics.analyze(repoPath);
            
            // Analyze quality trends
            const qualityTrends = await this.historyAnalyzer.analyze(repoPath);
            
            // Analyze technical debt
            const technicalDebt = await this.historyAnalyzer.analyzeTechnicalDebt(repoPath);
            
            return {
              path: repoPath,
              name: path.basename(repoPath),
              languages,
              frameworks,
              teamPreferences,
              qualityTrends,
              technicalDebt
            };
          } catch (error) {
            console.warn(`Error analyzing repository ${repoPath}:`, error);
            return {
              path: repoPath,
              name: path.basename(repoPath),
              languages: [],
              frameworks: [],
              teamPreferences: null,
              qualityTrends: [],
              technicalDebt: null
            };
          }
        })
      );
      
      // Filter out repositories with errors
      const validProfiles = repositoryProfiles.filter(
        profile => profile.languages.length > 0
      );
      
      if (validProfiles.length === 0) {
        throw new Error('No valid repository profiles found');
      }
      
      // Identify shared technologies
      const sharedTechnologies = this.identifySharedTechnologies(validProfiles);
      
      // Calculate consistency score
      const consistencyScore = this.calculateConsistencyScore(validProfiles);
      
      // Identify outlier repositories
      const outlierRepositories = this.identifyOutlierRepositories(validProfiles, consistencyScore);
      
      // Calculate best practice adoption
      const bestPracticeAdoption = await this.identifyBestPractices(repositoryPaths);
      
      // Calculate technology distribution
      const technologyDistribution = this.calculateTechnologyDistribution(validProfiles);
      
      return {
        sharedTechnologies,
        consistencyScore,
        outlierRepositories,
        bestPracticeAdoption,
        technologyDistribution
      };
    } catch (error) {
      console.error('Error analyzing multiple repositories:', error);
      throw error;
    }
  }

  /**
   * Compare standards compliance across repositories
   */
  async compareStandardsCompliance(repositoryPaths: string[]): Promise<ComplianceMetrics> {
    try {
      // Analyze each repository
      const repositoryCompliance = await Promise.all(
        repositoryPaths.map(async (repoPath) => {
          try {
            return await this.analyzeRepositoryCompliance(repoPath);
          } catch (error) {
            console.warn(`Error analyzing compliance for ${repoPath}:`, error);
            return {
              path: repoPath,
              name: path.basename(repoPath),
              overallCompliance: 0,
              standardsAdoption: {},
              securityCompliance: 0,
              accessibilityCompliance: 0,
              performanceCompliance: 0
            };
          }
        })
      );
      
      // Filter out repositories with errors
      const validCompliance = repositoryCompliance.filter(
        compliance => compliance.overallCompliance > 0
      );
      
      if (validCompliance.length === 0) {
        throw new Error('No valid compliance data found');
      }
      
      // Calculate average compliance metrics
      const overallCompliance = validCompliance.reduce(
        (sum, repo) => sum + repo.overallCompliance, 0
      ) / validCompliance.length;
      
      const securityCompliance = validCompliance.reduce(
        (sum, repo) => sum + repo.securityCompliance, 0
      ) / validCompliance.length;
      
      const accessibilityCompliance = validCompliance.reduce(
        (sum, repo) => sum + repo.accessibilityCompliance, 0
      ) / validCompliance.length;
      
      const performanceCompliance = validCompliance.reduce(
        (sum, repo) => sum + repo.performanceCompliance, 0
      ) / validCompliance.length;
      
      // Merge standards adoption
      const standardsAdoption: Record<string, number> = {};
      
      for (const repo of validCompliance) {
        for (const [standard, adoption] of Object.entries(repo.standardsAdoption)) {
          if (!standardsAdoption[standard]) {
            standardsAdoption[standard] = 0;
          }
          standardsAdoption[standard] += adoption;
        }
      }
      
      // Calculate average adoption
      for (const standard of Object.keys(standardsAdoption)) {
        standardsAdoption[standard] /= validCompliance.length;
      }
      
      return {
        overallCompliance,
        standardsAdoption,
        securityCompliance,
        accessibilityCompliance,
        performanceCompliance
      };
    } catch (error) {
      console.error('Error comparing standards compliance:', error);
      throw error;
    }
  }

  /**
   * Identify best practices across repositories
   */
  async identifyBestPractices(repositoryPaths: string[]): Promise<Record<string, number>> {
    try {
      // Define best practices to check
      const bestPractices = [
        'linter-configuration',
        'ci-cd-integration',
        'test-coverage',
        'documentation',
        'dependency-management',
        'security-scanning',
        'code-reviews',
        'semantic-versioning'
      ];
      
      // Check each repository for best practices
      const repositoryBestPractices = await Promise.all(
        repositoryPaths.map(async (repoPath) => {
          try {
            return await this.checkBestPractices(repoPath, bestPractices);
          } catch (error) {
            console.warn(`Error checking best practices for ${repoPath}:`, error);
            return {};
          }
        })
      );
      
      // Merge results
      const bestPracticeAdoption: Record<string, number> = {};
      
      for (const practice of bestPractices) {
        const adoptionCount = repositoryBestPractices.filter(
          repo => repo[practice]
        ).length;
        
        bestPracticeAdoption[practice] = (adoptionCount / repositoryPaths.length) * 100;
      }
      
      return bestPracticeAdoption;
    } catch (error) {
      console.error('Error identifying best practices:', error);
      return {};
    }
  }

  /**
   * Visualize technology stack across repositories
   */
  async visualizeTechnologyStack(repositoryPaths: string[]): Promise<Record<string, number>> {
    try {
      // Analyze each repository
      const repositoryProfiles = await Promise.all(
        repositoryPaths.map(async (repoPath) => {
          try {
            // Detect languages
            const languages = await this.languageDetector.analyze(repoPath);
            
            // Detect frameworks
            const frameworks = await this.frameworkAnalyzer.analyze(repoPath);
            
            return {
              path: repoPath,
              name: path.basename(repoPath),
              languages,
              frameworks
            };
          } catch (error) {
            console.warn(`Error analyzing repository ${repoPath}:`, error);
            return {
              path: repoPath,
              name: path.basename(repoPath),
              languages: [],
              frameworks: []
            };
          }
        })
      );
      
      // Filter out repositories with errors
      const validProfiles = repositoryProfiles.filter(
        profile => profile.languages.length > 0
      );
      
      if (validProfiles.length === 0) {
        throw new Error('No valid repository profiles found');
      }
      
      // Calculate technology distribution
      return this.calculateTechnologyDistribution(validProfiles);
    } catch (error) {
      console.error('Error visualizing technology stack:', error);
      return {};
    }
  }

  /**
   * Get capabilities of this analyzer
   */
  getCapabilities(): string[] {
    return [
      'multi-repository-analysis',
      'cross-repository-patterns',
      'standards-compliance',
      'best-practice-identification',
      'technology-stack-visualization'
    ];
  }

  /**
   * Check if this analyzer is available
   */
  async isAvailable(): Promise<boolean> {
    // Check if all required analyzers are available
    const languageDetectorAvailable = await this.languageDetector.isAvailable();
    const frameworkAnalyzerAvailable = await this.frameworkAnalyzer.isAvailable();
    const teamAnalyticsAvailable = await this.teamAnalytics.isAvailable();
    const historyAnalyzerAvailable = await this.historyAnalyzer.isAvailable();
    
    return (
      languageDetectorAvailable &&
      frameworkAnalyzerAvailable &&
      teamAnalyticsAvailable &&
      historyAnalyzerAvailable
    );
  }

  /**
   * Get performance metrics for the last operation
   */
  getPerformanceMetrics(): ProfilingPerformanceMetrics {
    return this.performanceMetrics;
  }

  // Private helper methods

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): ProfilingPerformanceMetrics {
    return {
      operationName: 'organization-analysis',
      executionTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Find all repositories in the organization
   */
  private async findRepositories(organizationPath: string): Promise<string[]> {
    const repositories: string[] = [];
    
    // Check if the path itself is a repository
    if (fs.existsSync(path.join(organizationPath, '.git'))) {
      repositories.push(organizationPath);
    }
    
    // Check for repositories in subdirectories
    try {
      const entries = fs.readdirSync(organizationPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(organizationPath, entry.name);
          
          // Skip hidden directories
          if (entry.name.startsWith('.')) {
            continue;
          }
          
          // Check if this is a git repository
          if (fs.existsSync(path.join(dirPath, '.git'))) {
            repositories.push(dirPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${organizationPath}:`, error);
    }
    
    return repositories;
  }

  /**
   * Identify shared technologies across repositories
   */
  private identifySharedTechnologies(repositoryProfiles: any[]): string[] {
    // Extract all languages and frameworks
    const allTechnologies = new Map<string, number>();
    
    for (const profile of repositoryProfiles) {
      // Add languages
      for (const lang of profile.languages) {
        const key = `language:${lang.language}`;
        allTechnologies.set(key, (allTechnologies.get(key) || 0) + 1);
      }
      
      // Add frameworks
      for (const framework of profile.frameworks) {
        const key = `framework:${framework.name}`;
        allTechnologies.set(key, (allTechnologies.get(key) || 0) + 1);
      }
    }
    
    // Find technologies used in at least 50% of repositories
    const sharedThreshold = Math.ceil(repositoryProfiles.length * 0.5);
    
    return Array.from(allTechnologies.entries())
      .filter(([, count]) => count >= sharedThreshold)
      .map(([tech]) => tech);
  }

  /**
   * Calculate consistency score across repositories
   */
  private calculateConsistencyScore(repositoryProfiles: any[]): number {
    if (repositoryProfiles.length <= 1) {
      return 100; // Perfect consistency with only one repository
    }
    
    // Calculate language consistency
    const languageConsistency = this.calculateTechnologyConsistency(
      repositoryProfiles.map(profile => profile.languages.map((lang: any) => lang.language))
    );
    
    // Calculate framework consistency
    const frameworkConsistency = this.calculateTechnologyConsistency(
      repositoryProfiles.map(profile => profile.frameworks.map((fw: any) => fw.name))
    );
    
    // Calculate team preferences consistency
    const teamConsistency = this.calculateTeamConsistency(
      repositoryProfiles.map(profile => profile.teamPreferences)
    );
    
    // Calculate quality trends consistency
    const qualityConsistency = this.calculateQualityConsistency(
      repositoryProfiles.map(profile => profile.qualityTrends)
    );
    
    // Calculate weighted average
    return (
      languageConsistency * 0.3 +
      frameworkConsistency * 0.3 +
      teamConsistency * 0.2 +
      qualityConsistency * 0.2
    );
  }

  /**
   * Identify outlier repositories
   */
  private identifyOutlierRepositories(repositoryProfiles: any[], consistencyScore: number): string[] {
    // If overall consistency is high, there are no outliers
    if (consistencyScore >= 80) {
      return [];
    }
    
    const outliers: string[] = [];
    
    // Calculate individual consistency scores
    for (const profile of repositoryProfiles) {
      const otherProfiles = repositoryProfiles.filter(p => p.path !== profile.path);
      
      // Calculate consistency with other repositories
      const individualConsistency = this.calculateConsistencyScore([
        profile,
        ...otherProfiles
      ]);
      
      // If this repository significantly reduces consistency, it's an outlier
      if (individualConsistency < consistencyScore - 15) {
        outliers.push(profile.name);
      }
    }
    
    return outliers;
  }

  /**
   * Calculate technology distribution across repositories
   */
  private calculateTechnologyDistribution(repositoryProfiles: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    // Count repositories using each technology
    for (const profile of repositoryProfiles) {
      // Add languages
      for (const lang of profile.languages) {
        const key = `language:${lang.language}`;
        distribution[key] = (distribution[key] || 0) + 1;
      }
      
      // Add frameworks
      for (const framework of profile.frameworks) {
        const key = `framework:${framework.name}`;
        distribution[key] = (distribution[key] || 0) + 1;
      }
    }
    
    // Convert counts to percentages
    for (const [tech, count] of Object.entries(distribution)) {
      distribution[tech] = (count / repositoryProfiles.length) * 100;
    }
    
    return distribution;
  }

  /**
   * Calculate technology consistency
   */
  private calculateTechnologyConsistency(technologiesList: string[][]): number {
    if (technologiesList.length <= 1) {
      return 100;
    }
    
    // Count occurrences of each technology
    const counts = new Map<string, number>();
    
    for (const technologies of technologiesList) {
      for (const tech of technologies) {
        counts.set(tech, (counts.get(tech) || 0) + 1);
      }
    }
    
    // Calculate Jaccard similarity for each pair of repositories
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < technologiesList.length; i++) {
      for (let j = i + 1; j < technologiesList.length; j++) {
        const similarity = this.calculateJaccardSimilarity(
          new Set(technologiesList[i]),
          new Set(technologiesList[j])
        );
        
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    
    // Calculate average similarity
    return pairCount > 0
      ? (totalSimilarity / pairCount) * 100
      : 100;
  }

  /**
   * Calculate team consistency
   */
  private calculateTeamConsistency(teamPreferencesList: any[]): number {
    // Filter out null values
    const validPreferences = teamPreferencesList.filter(prefs => prefs !== null);
    
    if (validPreferences.length <= 1) {
      return 100;
    }
    
    // Calculate consistency for each preference
    const indentationConsistency = this.calculateDiscreteConsistency(
      validPreferences.map(prefs => prefs.indentationStyle)
    );
    
    const indentSizeConsistency = this.calculateDiscreteConsistency(
      validPreferences.map(prefs => prefs.indentSize)
    );
    
    const lineEndingConsistency = this.calculateDiscreteConsistency(
      validPreferences.map(prefs => prefs.lineEndingStyle)
    );
    
    // Calculate weighted average
    return (
      indentationConsistency * 0.4 +
      indentSizeConsistency * 0.3 +
      lineEndingConsistency * 0.3
    );
  }

  /**
   * Calculate quality consistency
   */
  private calculateQualityConsistency(qualityTrendsList: any[]): number {
    // Filter out empty trends
    const validTrends = qualityTrendsList.filter(trends => trends.length > 0);
    
    if (validTrends.length <= 1) {
      return 100;
    }
    
    // Calculate trend direction consistency
    const trendDirections = validTrends.map(trends => {
      const trendCounts = {
        improving: 0,
        stable: 0,
        declining: 0
      };
      
      for (const trend of trends) {
        trendCounts[trend.trend as keyof typeof trendCounts]++;
      }
      
      // Return the dominant trend
      if (trendCounts.improving > trendCounts.stable && trendCounts.improving > trendCounts.declining) {
        return 'improving';
      } else if (trendCounts.declining > trendCounts.stable && trendCounts.declining > trendCounts.improving) {
        return 'declining';
      } else {
        return 'stable';
      }
    });
    
    return this.calculateDiscreteConsistency(trendDirections);
  }

  /**
   * Calculate discrete consistency
   */
  private calculateDiscreteConsistency(values: any[]): number {
    if (values.length <= 1) {
      return 100;
    }
    
    // Count occurrences of each value
    const counts = new Map<any, number>();
    
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    
    // Find the most common value
    let maxCount = 0;
    
    for (const count of counts.values()) {
      maxCount = Math.max(maxCount, count);
    }
    
    // Calculate consistency as the percentage of values that match the most common value
    return (maxCount / values.length) * 100;
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  private calculateJaccardSimilarity(setA: Set<any>, setB: Set<any>): number {
    if (setA.size === 0 && setB.size === 0) {
      return 1; // Both empty sets are identical
    }
    
    // Calculate intersection size
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    
    // Calculate union size
    const union = new Set([...setA, ...setB]);
    
    // Calculate Jaccard similarity
    return intersection.size / union.size;
  }

  /**
   * Analyze repository compliance
   */
  private async analyzeRepositoryCompliance(repositoryPath: string): Promise<ComplianceMetrics & { path: string; name: string }> {
    try {
      // Check for various compliance indicators
      const hasLinterConfig = this.checkForFile(repositoryPath, [
        '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
        '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml',
        '.mega-linter.yml', '.stylelintrc', 'tslint.json'
      ]);
      
      const hasSecurityConfig = this.checkForFile(repositoryPath, [
        '.github/dependabot.yml', '.github/workflows/codeql-analysis.yml',
        '.snyk', 'security.md', 'SECURITY.md'
      ]);
      
      const hasAccessibilityConfig = this.checkForFile(repositoryPath, [
        '.pa11yci', 'a11y.config.js', 'accessibility.md', 'ACCESSIBILITY.md'
      ]);
      
      const hasPerformanceConfig = this.checkForFile(repositoryPath, [
        'lighthouse.config.js', 'performance.md', 'PERFORMANCE.md'
      ]);
      
      const hasCICD = this.checkForFile(repositoryPath, [
        '.github/workflows', '.gitlab-ci.yml', '.travis.yml', 'azure-pipelines.yml',
        'Jenkinsfile', '.circleci/config.yml'
      ]);
      
      const hasTests = this.checkForFile(repositoryPath, [
        'test', 'tests', 'spec', '__tests__', '*.test.js', '*.spec.js'
      ]);
      
      const hasDocumentation = this.checkForFile(repositoryPath, [
        'README.md', 'CONTRIBUTING.md', 'docs', 'documentation'
      ]);
      
      // Calculate compliance scores
      const securityCompliance = hasSecurityConfig ? 100 : 0;
      const accessibilityCompliance = hasAccessibilityConfig ? 100 : 0;
      const performanceCompliance = hasPerformanceConfig ? 100 : 0;
      
      // Calculate standards adoption
      const standardsAdoption = {
        'linting': hasLinterConfig ? 100 : 0,
        'ci-cd': hasCICD ? 100 : 0,
        'testing': hasTests ? 100 : 0,
        'documentation': hasDocumentation ? 100 : 0,
        'security': hasSecurityConfig ? 100 : 0,
        'accessibility': hasAccessibilityConfig ? 100 : 0,
        'performance': hasPerformanceConfig ? 100 : 0
      };
      
      // Calculate overall compliance
      const overallCompliance = Object.values(standardsAdoption).reduce(
        (sum, value) => sum + value, 0
      ) / Object.values(standardsAdoption).length;
      
      return {
        path: repositoryPath,
        name: path.basename(repositoryPath),
        overallCompliance,
        standardsAdoption,
        securityCompliance,
        accessibilityCompliance,
        performanceCompliance
      };
    } catch (error) {
      console.warn(`Error analyzing compliance for ${repositoryPath}:`, error);
      
      return {
        path: repositoryPath,
        name: path.basename(repositoryPath),
        overallCompliance: 0,
        standardsAdoption: {},
        securityCompliance: 0,
        accessibilityCompliance: 0,
        performanceCompliance: 0
      };
    }
  }

  /**
   * Check for best practices in a repository
   */
  private async checkBestPractices(
    repositoryPath: string,
    bestPractices: string[]
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    
    // Check for linter configuration
    result['linter-configuration'] = this.checkForFile(repositoryPath, [
      '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml',
      '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml',
      '.mega-linter.yml', '.stylelintrc', 'tslint.json'
    ]);
    
    // Check for CI/CD integration
    result['ci-cd-integration'] = this.checkForFile(repositoryPath, [
      '.github/workflows', '.gitlab-ci.yml', '.travis.yml', 'azure-pipelines.yml',
      'Jenkinsfile', '.circleci/config.yml'
    ]);
    
    // Check for test coverage
    result['test-coverage'] = this.checkForFile(repositoryPath, [
      'test', 'tests', 'spec', '__tests__', '*.test.js', '*.spec.js',
      'jest.config.js', 'karma.conf.js', 'cypress.json', 'codecov.yml'
    ]);
    
    // Check for documentation
    result['documentation'] = this.checkForFile(repositoryPath, [
      'README.md', 'CONTRIBUTING.md', 'docs', 'documentation'
    ]);
    
    // Check for dependency management
    result['dependency-management'] = this.checkForFile(repositoryPath, [
      'package.json', 'yarn.lock', 'pnpm-lock.yaml', 'requirements.txt',
      'Pipfile', 'Gemfile', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle',
      '.github/dependabot.yml'
    ]);
    
    // Check for security scanning
    result['security-scanning'] = this.checkForFile(repositoryPath, [
      '.github/workflows/codeql-analysis.yml', '.snyk', 'security.md', 'SECURITY.md'
    ]);
    
    // Check for code reviews
    result['code-reviews'] = this.checkForFile(repositoryPath, [
      '.github/CODEOWNERS', 'CODEOWNERS', '.github/pull_request_template.md'
    ]);
    
    // Check for semantic versioning
    result['semantic-versioning'] = this.checkForSemanticVersioning(repositoryPath);
    
    return result;
  }

  /**
   * Check for the existence of files or directories
   */
  private checkForFile(repositoryPath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // Check if pattern contains a wildcard
      if (pattern.includes('*')) {
        // This is a simplified glob pattern check
        // In a real implementation, we would use a proper glob matcher
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        
        try {
          const files = fs.readdirSync(repositoryPath);
          
          for (const file of files) {
            if (regex.test(file)) {
              return true;
            }
          }
        } catch (error) {
          // Ignore directory read errors
        }
      } else {
        // Check for exact file or directory
        const filePath = path.join(repositoryPath, pattern);
        
        if (fs.existsSync(filePath)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check for semantic versioning
   */
  private checkForSemanticVersioning(repositoryPath: string): boolean {
    // TODO: Implement semantic versioning check
    return false;
  }
}