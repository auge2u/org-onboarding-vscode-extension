/**
 * Historical Code Pattern Analyzer
 * Analyzes git history to detect code quality trends, refactoring patterns, and technical debt
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HistoryAnalyzer, QualityTrend, TechnicalDebtMetrics, RefactoringOpportunity, ProfilingOptions, ProfilingPerformanceMetrics } from './types';
import { walkDirectory } from './languageDetectorHelpers';

const execAsync = promisify(exec);

// File change history entry
interface FileChangeHistory {
  path: string;
  changes: {
    date: Date;
    additions: number;
    deletions: number;
    author: string;
    message: string;
  }[];
  totalChanges: number;
  churnRate: number;
  lastModified: Date;
}

// Code quality metrics
interface CodeQualityMetrics {
  date: Date;
  complexity: number;
  duplication: number;
  testCoverage: number;
  lintErrors: number;
  lintWarnings: number;
  technicalDebtScore: number;
}

/**
 * History analyzer implementation
 */
export class AdvancedHistoryAnalyzer implements HistoryAnalyzer {
  private readonly resultCache: Map<string, QualityTrend[]> = new Map();
  private readonly debtCache: Map<string, TechnicalDebtMetrics> = new Map();
  private readonly maxCacheSize = 20;
  private performanceMetrics: ProfilingPerformanceMetrics;

  constructor() {
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Analyze repository to detect historical quality trends
   */
  async analyze(repositoryPath: string, options?: ProfilingOptions): Promise<QualityTrend[]> {
    const startTime = Date.now();
    const cacheResults = options?.cacheResults !== false;
    const timeoutMs = options?.timeoutMs || 60000; // Git operations can take longer

    // Reset performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.performanceMetrics.operationName = 'history-analysis';

    try {
      // Check cache first
      if (cacheResults && this.resultCache.has(repositoryPath)) {
        this.performanceMetrics.cacheHits++;
        return this.resultCache.get(repositoryPath)!;
      }
      this.performanceMetrics.cacheMisses++;

      // Analyze quality trends
      const qualityTrends = await this.analyzeQualityTrends(repositoryPath);
      
      // Cache results
      if (cacheResults) {
        if (this.resultCache.size >= this.maxCacheSize) {
          const oldestKey = this.resultCache.keys().next().value;
          this.resultCache.delete(oldestKey);
        }
        this.resultCache.set(repositoryPath, qualityTrends);
      }

      // Update performance metrics
      this.performanceMetrics.executionTime = Date.now() - startTime;
      
      return qualityTrends;
    } catch (error) {
      console.error('Error in history analysis:', error);
      throw new Error(`History analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze quality trends over time
   */
  async analyzeQualityTrends(repositoryPath: string): Promise<QualityTrend[]> {
    try {
      // Check if repository has a .git directory
      const gitDir = path.join(repositoryPath, '.git');
      if (!fs.existsSync(gitDir)) {
        throw new Error('Not a git repository');
      }

      // Get file change history
      const fileChanges = await this.getFileChangeHistory(repositoryPath);
      
      // Calculate quality metrics over time
      const qualityMetrics = await this.calculateQualityMetrics(repositoryPath, fileChanges);
      
      // Generate quality trends
      const trends: QualityTrend[] = [
        {
          metric: 'complexity',
          values: qualityMetrics.map(m => ({ timestamp: m.date, value: m.complexity })),
          trend: this.calculateTrendDirection(qualityMetrics.map(m => m.complexity))
        },
        {
          metric: 'duplication',
          values: qualityMetrics.map(m => ({ timestamp: m.date, value: m.duplication })),
          trend: this.calculateTrendDirection(qualityMetrics.map(m => m.duplication))
        },
        {
          metric: 'testCoverage',
          values: qualityMetrics.map(m => ({ timestamp: m.date, value: m.testCoverage })),
          trend: this.calculateTrendDirection(qualityMetrics.map(m => m.testCoverage), true)
        },
        {
          metric: 'lintIssues',
          values: qualityMetrics.map(m => ({ timestamp: m.date, value: m.lintErrors + m.lintWarnings })),
          trend: this.calculateTrendDirection(qualityMetrics.map(m => m.lintErrors + m.lintWarnings))
        },
        {
          metric: 'technicalDebt',
          values: qualityMetrics.map(m => ({ timestamp: m.date, value: m.technicalDebtScore })),
          trend: this.calculateTrendDirection(qualityMetrics.map(m => m.technicalDebtScore))
        }
      ];
      
      return trends;
    } catch (error) {
      console.warn('Error analyzing quality trends:', error);
      return [];
    }
  }

  /**
   * Analyze technical debt
   */
  async analyzeTechnicalDebt(repositoryPath: string): Promise<TechnicalDebtMetrics> {
    // Check cache first
    if (this.debtCache.has(repositoryPath)) {
      return this.debtCache.get(repositoryPath)!;
    }

    try {
      // Get file change history
      const fileChanges = await this.getFileChangeHistory(repositoryPath);
      
      // Identify high-churn files
      const highChurnFiles = fileChanges
        .filter(file => file.churnRate > 2.0) // Files with high churn rate
        .sort((a, b) => b.churnRate - a.churnRate)
        .slice(0, 10); // Top 10 high-churn files
      
      // Identify old, unchanged files
      const oldFiles = fileChanges
        .filter(file => {
          const daysSinceLastChange = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastChange > 180 && file.totalChanges > 10; // Unchanged for 6+ months but has history
        })
        .sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime())
        .slice(0, 10); // Top 10 oldest files
      
      // Identify complex files
      const complexFiles = await this.identifyComplexFiles(repositoryPath);
      
      // Identify refactoring opportunities
      const refactoringOpportunities = await this.identifyRefactoringOpportunities(
        repositoryPath,
        highChurnFiles,
        oldFiles,
        complexFiles
      );
      
      // Calculate overall debt score
      const overallDebtScore = this.calculateOverallDebtScore(
        highChurnFiles.length,
        oldFiles.length,
        complexFiles.length,
        refactoringOpportunities.length
      );
      
      // Calculate debt by category
      const debtByCategory = {
        'churn': highChurnFiles.length * 10,
        'legacy': oldFiles.length * 8,
        'complexity': complexFiles.length * 12,
        'duplication': refactoringOpportunities.filter(r => r.type === 'duplication').length * 7
      };
      
      // Determine debt trend
      const debtTrend = await this.determineTechnicalDebtTrend(repositoryPath);
      
      // Calculate velocity impact
      const velocityImpact = this.calculateVelocityImpact(overallDebtScore);
      
      // Create result
      const result: TechnicalDebtMetrics = {
        overallDebtScore,
        debtByCategory,
        debtTrend,
        refactoringOpportunities,
        velocityImpact
      };
      
      // Cache result
      if (this.debtCache.size >= this.maxCacheSize) {
        const oldestKey = this.debtCache.keys().next().value;
        this.debtCache.delete(oldestKey);
      }
      this.debtCache.set(repositoryPath, result);
      
      return result;
    } catch (error) {
      console.warn('Error analyzing technical debt:', error);
      
      // Return empty result on error
      return {
        overallDebtScore: 0,
        debtByCategory: {},
        debtTrend: 'stable',
        refactoringOpportunities: [],
        velocityImpact: 0
      };
    }
  }

  /**
   * Identify refactoring opportunities
   */
  async identifyRefactoringOpportunities(repositoryPath: string): Promise<RefactoringOpportunity[]> {
    try {
      // Get file change history
      const fileChanges = await this.getFileChangeHistory(repositoryPath);
      
      // Identify high-churn files
      const highChurnFiles = fileChanges
        .filter(file => file.churnRate > 2.0) // Files with high churn rate
        .sort((a, b) => b.churnRate - a.churnRate)
        .slice(0, 10); // Top 10 high-churn files
      
      // Identify old, unchanged files
      const oldFiles = fileChanges
        .filter(file => {
          const daysSinceLastChange = (Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLastChange > 180 && file.totalChanges > 10; // Unchanged for 6+ months but has history
        })
        .sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime())
        .slice(0, 10); // Top 10 oldest files
      
      // Identify complex files
      const complexFiles = await this.identifyComplexFiles(repositoryPath);
      
      return this.identifyRefactoringOpportunities(
        repositoryPath,
        highChurnFiles,
        oldFiles,
        complexFiles
      );
    } catch (error) {
      console.warn('Error identifying refactoring opportunities:', error);
      return [];
    }
  }

  /**
   * Track development velocity
   */
  async trackVelocity(repositoryPath: string): Promise<number> {
    try {
      // Get commit history
      const { stdout: logOutput } = await execAsync(
        'git log --pretty=format:"%at" --since="3 months ago"',
        { cwd: repositoryPath }
      );
      
      // Parse commit timestamps
      const timestamps = logOutput.split('\n')
        .filter(line => line.trim())
        .map(line => parseInt(line.trim(), 10) * 1000);
      
      if (timestamps.length === 0) {
        return 0;
      }
      
      // Sort timestamps
      timestamps.sort();
      
      // Calculate average commits per week
      const firstCommit = new Date(timestamps[0]);
      const lastCommit = new Date(timestamps[timestamps.length - 1]);
      const weeksDiff = (lastCommit.getTime() - firstCommit.getTime()) / (1000 * 60 * 60 * 24 * 7);
      
      if (weeksDiff <= 0) {
        return timestamps.length; // All commits in the same week
      }
      
      return timestamps.length / weeksDiff;
    } catch (error) {
      console.warn('Error tracking velocity:', error);
      return 0;
    }
  }

  /**
   * Get capabilities of this analyzer
   */
  getCapabilities(): string[] {
    return [
      'quality-trend-analysis',
      'technical-debt-detection',
      'refactoring-opportunity-identification',
      'velocity-tracking',
      'code-churn-analysis'
    ];
  }

  /**
   * Check if this analyzer is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if git is available
      await execAsync('git --version');
      return true;
    } catch (error) {
      return false;
    }
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
      operationName: 'history-analysis',
      executionTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Get file change history from git
   */
  private async getFileChangeHistory(repositoryPath: string): Promise<FileChangeHistory[]> {
    try {
      // Get list of files in the repository
      const files: string[] = [];
      await walkDirectory(
        repositoryPath,
        (filePath) => {
          const relativePath = path.relative(repositoryPath, filePath);
          files.push(relativePath);
        }
      );
      
      // Get change history for each file
      const fileChanges: FileChangeHistory[] = [];
      
      for (const filePath of files) {
        try {
          // Skip binary files and non-source files
          if (this.isBinaryFile(filePath) || !this.isSourceFile(filePath)) {
            continue;
          }
          
          // Get git log for this file
          const { stdout: logOutput } = await execAsync(
            `git log --follow --format="%h|%an|%at|%s" --numstat -- "${filePath}"`,
            { cwd: repositoryPath }
          );
          
          // Parse git log output
          const changes: FileChangeHistory['changes'] = [];
          let currentCommit: { hash: string; author: string; timestamp: number; message: string } | null = null;
          
          const lines = logOutput.split('\n');
          for (const line of lines) {
            if (line.includes('|')) {
              // This is a commit line
              const [hash, author, timestamp, message] = line.split('|');
              currentCommit = {
                hash,
                author,
                timestamp: parseInt(timestamp, 10),
                message
              };
            } else if (line.trim() && currentCommit) {
              // This is a file stats line
              const parts = line.trim().split('\t');
              if (parts.length === 3) {
                const [additions, deletions] = parts;
                
                // Skip binary files
                if (additions === '-' || deletions === '-') {
                  continue;
                }
                
                changes.push({
                  date: new Date(currentCommit.timestamp * 1000),
                  additions: parseInt(additions, 10) || 0,
                  deletions: parseInt(deletions, 10) || 0,
                  author: currentCommit.author,
                  message: currentCommit.message
                });
              }
            }
          }
          
          // Calculate total changes and churn rate
          const totalChanges = changes.reduce((sum, change) => sum + change.additions + change.deletions, 0);
          const churnRate = this.calculateChurnRate(changes);
          
          // Get last modified date
          const lastModified = changes.length > 0
            ? changes[0].date
            : new Date();
          
          fileChanges.push({
            path: filePath,
            changes,
            totalChanges,
            churnRate,
            lastModified
          });
        } catch (error) {
          // Skip files with errors
          console.warn(`Error getting history for ${filePath}:`, error);
        }
      }
      
      return fileChanges;
    } catch (error) {
      console.warn('Error getting file change history:', error);
      return [];
    }
  }

  /**
   * Calculate quality metrics over time
   */
  private async calculateQualityMetrics(
    repositoryPath: string,
    fileChanges: FileChangeHistory[]
  ): Promise<CodeQualityMetrics[]> {
    try {
      // Get significant commits (e.g., monthly)
      const { stdout: logOutput } = await execAsync(
        'git log --pretty=format:"%h|%at" --no-merges --date-order --reverse',
        { cwd: repositoryPath }
      );
      
      // Parse commit hashes and timestamps
      const commits = logOutput.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, timestamp] = line.split('|');
          return {
            hash,
            date: new Date(parseInt(timestamp, 10) * 1000)
          };
        });
      
      // Group commits by month
      const commitsByMonth: Record<string, { hash: string; date: Date }[]> = {};
      
      for (const commit of commits) {
        const monthKey = `${commit.date.getFullYear()}-${commit.date.getMonth() + 1}`;
        
        if (!commitsByMonth[monthKey]) {
          commitsByMonth[monthKey] = [];
        }
        
        commitsByMonth[monthKey].push(commit);
      }
      
      // Take the last commit of each month
      const significantCommits = Object.values(commitsByMonth)
        .map(monthCommits => monthCommits[monthCommits.length - 1]);
      
      // Limit to last 12 months or less
      const limitedCommits = significantCommits.slice(-12);
      
      // Calculate metrics for each significant commit
      const metrics: CodeQualityMetrics[] = [];
      
      for (const commit of limitedCommits) {
        try {
          // Checkout this commit
          await execAsync(`git checkout ${commit.hash} --quiet`, { cwd: repositoryPath });
          
          // Calculate metrics at this point in time
          const complexity = await this.calculateComplexity(repositoryPath);
          const duplication = await this.calculateDuplication(repositoryPath);
          const testCoverage = await this.estimateTestCoverage(repositoryPath);
          const { errors, warnings } = await this.estimateLintIssues(repositoryPath);
          
          // Calculate technical debt score
          const technicalDebtScore = this.calculateTechnicalDebtScore(
            complexity,
            duplication,
            testCoverage,
            errors,
            warnings
          );
          
          metrics.push({
            date: commit.date,
            complexity,
            duplication,
            testCoverage,
            lintErrors: errors,
            lintWarnings: warnings,
            technicalDebtScore
          });
        } catch (error) {
          console.warn(`Error calculating metrics for commit ${commit.hash}:`, error);
        }
      }
      
      // Checkout back to the original branch
      await execAsync('git checkout - --quiet', { cwd: repositoryPath });
      
      return metrics;
    } catch (error) {
      console.warn('Error calculating quality metrics:', error);
      
      // Return empty metrics
      return [];
    }
  }

  /**
   * Identify complex files
   */
  private async identifyComplexFiles(repositoryPath: string): Promise<{ path: string; complexity: number }[]> {
    const complexFiles: { path: string; complexity: number }[] = [];
    
    await walkDirectory(
      repositoryPath,
      async (filePath) => {
        try {
          // Skip binary files and non-source files
          if (this.isBinaryFile(filePath) || !this.isSourceFile(filePath)) {
            return;
          }
          
          // Read file content
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Calculate complexity metrics
          const complexity = this.calculateFileComplexity(content, filePath);
          
          if (complexity > 20) { // High complexity threshold
            complexFiles.push({
              path: path.relative(repositoryPath, filePath),
              complexity
            });
          }
        } catch (error) {
          // Skip files with errors
        }
      }
    );
    
    // Sort by complexity (descending)
    return complexFiles.sort((a, b) => b.complexity - a.complexity);
  }

  /**
   * Identify refactoring opportunities
   */
  private async identifyRefactoringOpportunities(
    repositoryPath: string,
    highChurnFiles: FileChangeHistory[],
    oldFiles: FileChangeHistory[],
    complexFiles: { path: string; complexity: number }[]
  ): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    
    // Add high-churn files as refactoring opportunities
    for (const file of highChurnFiles) {
      opportunities.push({
        id: `churn-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        path: file.path,
        type: 'duplication',
        severity: file.churnRate > 5 ? 'high' : 'medium',
        estimatedEffort: Math.min(10, Math.ceil(file.churnRate)),
        potentialImpact: Math.min(10, Math.ceil(file.churnRate * 1.5)),
        description: `High churn file (${file.churnRate.toFixed(1)}x average) indicating potential design issues`
      });
    }
    
    // Add complex files as refactoring opportunities
    for (const file of complexFiles) {
      opportunities.push({
        id: `complex-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        path: file.path,
        type: 'complexity',
        severity: file.complexity > 50 ? 'high' : 'medium',
        estimatedEffort: Math.min(10, Math.ceil(file.complexity / 10)),
        potentialImpact: Math.min(10, Math.ceil(file.complexity / 8)),
        description: `Complex file (score: ${file.complexity}) that could be simplified`
      });
    }
    
    // Add old files as refactoring opportunities
    for (const file of oldFiles) {
      const daysSinceLastChange = Math.floor((Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24));
      
      opportunities.push({
        id: `legacy-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        path: file.path,
        type: 'legacy',
        severity: daysSinceLastChange > 365 ? 'high' : 'medium',
        estimatedEffort: Math.min(10, Math.ceil(file.totalChanges / 50)),
        potentialImpact: Math.min(10, Math.ceil(file.totalChanges / 40)),
        description: `Legacy file unchanged for ${daysSinceLastChange} days that may need modernization`
      });
    }
    
    // Detect potential code duplication
    const duplicationOpportunities = await this.detectCodeDuplication(repositoryPath);
    opportunities.push(...duplicationOpportunities);
    
    // Remove duplicates
    const uniqueOpportunities = opportunities.filter((opportunity, index, self) =>
      index === self.findIndex(o => o.path === opportunity.path && o.type === opportunity.type)
    );
    
    // Sort by severity and potential impact
    return uniqueOpportunities.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'high' ? -1 : 1;
      }
      return b.potentialImpact - a.potentialImpact;
    });
  }

  /**
   * Detect code duplication
   */
  private async detectCodeDuplication(repositoryPath: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    
    // This would be a more sophisticated analysis in a real implementation
    // For now, we'll just look for files with similar names in the same directory
    
    const filesByDir: Record<string, string[]> = {};
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const relativePath = path.relative(repositoryPath, filePath);
        const dir = path.dirname(relativePath);
        const fileName = path.basename(relativePath);
        
        // Skip binary files and non-source files
        if (this.isBinaryFile(fileName) || !this.isSourceFile(fileName)) {
          return;
        }
        
        if (!filesByDir[dir]) {
          filesByDir[dir] = [];
        }
        
        filesByDir[dir].push(relativePath);
      }
    );
    
    // Look for similar file names in the same directory
    for (const [dir, files] of Object.entries(filesByDir)) {
      if (files.length < 2) {
        continue;
      }
      
      // Group files by their base name (without extension)
      const filesByBaseName: Record<string, string[]> = {};
      
      for (const file of files) {
        const baseName = path.basename(file, path.extname(file))
          .replace(/[0-9]+$/, '') // Remove trailing numbers
          .replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters
        
        if (baseName.length < 3) {
          continue; // Skip very short base names
        }
        
        if (!filesByBaseName[baseName]) {
          filesByBaseName[baseName] = [];
        }
        
        filesByBaseName[baseName].push(file);
      }
      
      // Find groups with similar names
      for (const [baseName, similarFiles] of Object.entries(filesByBaseName)) {
        if (similarFiles.length >= 2) {
          opportunities.push({
            id: `duplication-${dir.replace(/[^a-zA-Z0-9]/g, '-')}-${baseName}`,
            path: dir,
            type: 'duplication',
            severity: similarFiles.length > 3 ? 'high' : 'medium',
            estimatedEffort: Math.min(10, similarFiles.length * 2),
            potentialImpact: Math.min(10, similarFiles.length * 3),
            description: `Potential code duplication in ${similarFiles.length} similar files`
          });
        }
      }
    }
    
    return opportunities;
  }

  /**
   * Calculate churn rate for a file
   */
  private calculateChurnRate(changes: FileChangeHistory['changes']): number {
    if (changes.length === 0) {
      return 0;
    }
    
    // Calculate total lines added and deleted
    const totalAdditions = changes.reduce((sum, change) => sum + change.additions, 0);
    const totalDeletions = changes.reduce((sum, change) => sum + change.deletions, 0);
    
    // Get current file size (last change)
    const currentSize = changes[0].additions - changes[0].deletions;
    
    if (currentSize <= 0) {
      return 0;
    }
    
    // Calculate churn rate
    return (totalAdditions + totalDeletions) / currentSize;
  }

  /**
   * Calculate complexity of a file
   */
  private calculateFileComplexity(content: string, filePath: string): number {
    // This is a simplified complexity calculation
    // In a real implementation, we would use a proper AST parser
    
    const ext = path.extname(filePath).toLowerCase();
    let complexity = 0;
    
    // Count lines
    const lines = content.split('\n');
    complexity += lines.length / 10;
    
    // Count branches (if, switch, etc.)
    const branchMatches = content.match(/\b(if|else|switch|case|for|while|catch)\b/g);
    if (branchMatches) {
      complexity += branchMatches.length * 2;
    }
    
    // Count functions/methods
    const functionMatches = content.match(/\b(function|def|method|func)\b/g);
    if (functionMatches) {
      complexity += functionMatches.length * 3;
    }
    
    // Count classes
    const classMatches = content.match(/\b(class|interface|struct|enum)\b/g);
    if (classMatches) {
      complexity += classMatches.length * 5;
    }
    
    // Count nesting depth
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const line of lines) {
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      currentDepth += openBraces - closeBraces;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    
    complexity += maxDepth * 3;
    
    return Math.round(complexity);
  }

  /**
   * Calculate overall complexity of a repository
   */
  private async calculateComplexity(repositoryPath: string): Promise<number> {
    let totalComplexity = 0;
    let fileCount = 0;
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        try {
          // Skip binary files and non-source files
          if (this.isBinaryFile(filePath) || !this.isSourceFile(filePath)) {
            return;
          }
          
          // Read file content
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Calculate complexity
          const complexity = this.calculateFileComplexity(content, filePath);
          totalComplexity += complexity;
          fileCount++;
        } catch (error) {
          // Skip files with errors
        }
      }
    );
    
    return fileCount > 0 ? Math.round(totalComplexity / fileCount) : 0;
  }

  /**
   * Calculate code duplication in a repository
   */
  private async calculateDuplication(repositoryPath: string): Promise<number> {
    // This is a simplified duplication calculation
    // In a real implementation, we would use a proper duplication detector
    
    // Count files with similar names
    const filesByBaseName: Record<string, string[]> = {};
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const fileName = path.basename(filePath);
        const baseName = path.basename(fileName, path.extname(fileName))
          .replace(/[0-9]+$/, '') // Remove trailing numbers
          .replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters
        
        if (baseName.length < 3) {