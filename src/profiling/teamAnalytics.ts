/**
 * Team Analytics
 * Analyzes git history and code patterns to detect team preferences and coding styles
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TeamAnalytics, TeamPreferences, GitHistoryAnalysisResult, AuthorActivity, CommitPattern, ProfilingOptions, ProfilingPerformanceMetrics } from './types';
import { walkDirectory } from './languageDetectorHelpers';

const execAsync = promisify(exec);

/**
 * Team analytics implementation
 */
export class AdvancedTeamAnalytics implements TeamAnalytics {
  private readonly resultCache: Map<string, TeamPreferences> = new Map();
  private readonly gitHistoryCache: Map<string, GitHistoryAnalysisResult> = new Map();
  private readonly maxCacheSize = 20;
  private performanceMetrics: ProfilingPerformanceMetrics;

  constructor() {
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Analyze repository to detect team preferences
   */
  async analyze(repositoryPath: string, options?: ProfilingOptions): Promise<TeamPreferences> {
    const startTime = Date.now();
    const cacheResults = options?.cacheResults !== false;
    const timeoutMs = options?.timeoutMs || 60000; // Git operations can take longer

    // Reset performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.performanceMetrics.operationName = 'team-analytics';

    try {
      // Check cache first
      if (cacheResults && this.resultCache.has(repositoryPath)) {
        this.performanceMetrics.cacheHits++;
        return this.resultCache.get(repositoryPath)!;
      }
      this.performanceMetrics.cacheMisses++;

      // Analyze git history
      const gitHistory = await this.analyzeGitHistory(repositoryPath);
      
      // Detect coding preferences
      const codingPreferences = await this.detectCodingPreferences(repositoryPath);
      
      // Map code ownership
      const codeOwnership = await this.mapCodeOwnership(repositoryPath);
      
      // Identify developer specializations
      const specializations = await this.identifySpecializations(repositoryPath);
      
      // Combine results
      const teamPreferences: TeamPreferences = {
        ...codingPreferences,
        commitPatterns: gitHistory.authors.map(author => ({
          author: author.name,
          frequency: author.commits,
          timeOfDay: this.getTimeOfDayPreferences(author),
          filesModified: author.filesModified.slice(0, 10), // Top 10 files
          linesChanged: author.linesAdded + author.linesRemoved,
          commitMessageStyle: this.detectCommitMessageStyle(author)
        }))
      };
      
      // Cache results
      if (cacheResults) {
        if (this.resultCache.size >= this.maxCacheSize) {
          const oldestKey = this.resultCache.keys().next().value;
          this.resultCache.delete(oldestKey);
        }
        this.resultCache.set(repositoryPath, teamPreferences);
      }

      // Update performance metrics
      this.performanceMetrics.executionTime = Date.now() - startTime;
      
      return teamPreferences;
    } catch (error) {
      console.error('Error in team analytics:', error);
      throw new Error(`Team analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze git history
   */
  async analyzeGitHistory(repositoryPath: string): Promise<GitHistoryAnalysisResult> {
    // Check cache first
    if (this.gitHistoryCache.has(repositoryPath)) {
      return this.gitHistoryCache.get(repositoryPath)!;
    }

    try {
      // Check if repository has a .git directory
      const gitDir = path.join(repositoryPath, '.git');
      if (!fs.existsSync(gitDir)) {
        throw new Error('Not a git repository');
      }

      // Get commit history
      const { stdout: logOutput } = await execAsync(
        'git log --pretty=format:"%h|%an|%ae|%at|%s" --numstat',
        { cwd: repositoryPath, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large repos
      );

      // Parse git log output
      const authors = new Map<string, AuthorActivity>();
      const fileChurn = new Map<string, number>();
      let totalCommits = 0;
      let currentCommit: { hash: string; author: string; email: string; timestamp: number; message: string } | null = null;
      
      const lines = logOutput.split('\n');
      for (const line of lines) {
        if (line.includes('|')) {
          // This is a commit line
          const [hash, author, email, timestamp, message] = line.split('|');
          currentCommit = {
            hash,
            author,
            email,
            timestamp: parseInt(timestamp, 10),
            message
          };
          totalCommits++;
          
          // Initialize author if not exists
          if (!authors.has(email)) {
            authors.set(email, {
              name: author,
              email,
              commits: 0,
              filesModified: [],
              linesAdded: 0,
              linesRemoved: 0,
              activeTimeSpan: {
                first: new Date(parseInt(timestamp, 10) * 1000),
                last: new Date(parseInt(timestamp, 10) * 1000)
              },
              commitPattern: {
                dayOfWeek: {
                  'Monday': 0,
                  'Tuesday': 0,
                  'Wednesday': 0,
                  'Thursday': 0,
                  'Friday': 0,
                  'Saturday': 0,
                  'Sunday': 0
                },
                timeOfDay: {
                  'Morning (6-12)': 0,
                  'Afternoon (12-18)': 0,
                  'Evening (18-24)': 0,
                  'Night (0-6)': 0
                }
              }
            });
          }
          
          // Update author stats
          const authorData = authors.get(email)!;
          authorData.commits++;
          
          // Update time span
          const commitDate = new Date(parseInt(timestamp, 10) * 1000);
          if (commitDate < authorData.activeTimeSpan.first) {
            authorData.activeTimeSpan.first = commitDate;
          }
          if (commitDate > authorData.activeTimeSpan.last) {
            authorData.activeTimeSpan.last = commitDate;
          }
          
          // Update commit pattern
          const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][commitDate.getDay()];
          authorData.commitPattern.dayOfWeek[day]++;
          
          const hour = commitDate.getHours();
          if (hour >= 6 && hour < 12) {
            authorData.commitPattern.timeOfDay['Morning (6-12)']++;
          } else if (hour >= 12 && hour < 18) {
            authorData.commitPattern.timeOfDay['Afternoon (12-18)']++;
          } else if (hour >= 18 && hour < 24) {
            authorData.commitPattern.timeOfDay['Evening (18-24)']++;
          } else {
            authorData.commitPattern.timeOfDay['Night (0-6)']++;
          }
        } else if (line.trim() && currentCommit) {
          // This is a file stats line
          const parts = line.trim().split('\t');
          if (parts.length === 3) {
            const [added, removed, file] = parts;
            
            // Skip binary files
            if (added === '-' || removed === '-') {
              continue;
            }
            
            // Update author stats
            const authorData = authors.get(currentCommit.email)!;
            authorData.linesAdded += parseInt(added, 10) || 0;
            authorData.linesRemoved += parseInt(removed, 10) || 0;
            
            // Track modified files
            if (!authorData.filesModified.includes(file)) {
              authorData.filesModified.push(file);
            }
            
            // Update file churn
            fileChurn.set(file, (fileChurn.get(file) || 0) + parseInt(added, 10) + parseInt(removed, 10));
          }
        }
      }
      
      // Find first and last commit dates
      let firstCommit = new Date();
      let lastCommit = new Date(0);
      
      for (const author of authors.values()) {
        if (author.activeTimeSpan.first < firstCommit) {
          firstCommit = author.activeTimeSpan.first;
        }
        if (author.activeTimeSpan.last > lastCommit) {
          lastCommit = author.activeTimeSpan.last;
        }
      }
      
      // Create result
      const result: GitHistoryAnalysisResult = {
        totalCommits,
        authors: Array.from(authors.values()),
        commitFrequency: this.calculateCommitFrequency(Array.from(authors.values())),
        fileChurn: Object.fromEntries(fileChurn),
        codeOwnership: this.calculateCodeOwnership(Array.from(authors.values())),
        timeSpan: {
          firstCommit,
          lastCommit
        }
      };
      
      // Cache result
      if (this.gitHistoryCache.size >= this.maxCacheSize) {
        const oldestKey = this.gitHistoryCache.keys().next().value;
        this.gitHistoryCache.delete(oldestKey);
      }
      this.gitHistoryCache.set(repositoryPath, result);
      
      return result;
    } catch (error) {
      console.warn('Error analyzing git history:', error);
      
      // Return empty result on error
      return {
        totalCommits: 0,
        authors: [],
        commitFrequency: {},
        fileChurn: {},
        codeOwnership: {},
        timeSpan: {
          firstCommit: new Date(),
          lastCommit: new Date()
        }
      };
    }
  }

  /**
   * Detect coding preferences from code files
   */
  async detectCodingPreferences(repositoryPath: string): Promise<TeamPreferences> {
    // Initialize with defaults
    const preferences: TeamPreferences = {
      indentationStyle: 'spaces',
      indentSize: 4,
      lineEndingStyle: 'LF',
      namingConventions: {
        variables: 'unknown',
        functions: 'unknown',
        classes: 'unknown',
        constants: 'unknown'
      },
      codeFormatting: {
        braceStyle: 'unknown',
        maxLineLength: 80,
        trailingCommas: false,
        semicolons: true
      },
      preferredPatterns: [],
      commitPatterns: []
    };
    
    // Analyze code files
    const fileStats = await this.analyzeCodeFiles(repositoryPath);
    
    // Determine indentation style
    if (fileStats.tabCount > fileStats.spaceCount) {
      preferences.indentationStyle = 'tabs';
    } else {
      preferences.indentationStyle = 'spaces';
    }
    
    // Determine indent size
    if (fileStats.indentSizes.size > 0) {
      // Find the most common indent size
      let maxCount = 0;
      let mostCommonSize = 4;
      
      for (const [size, count] of fileStats.indentSizes.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonSize = size;
        }
      }
      
      preferences.indentSize = mostCommonSize;
    }
    
    // Determine line ending style
    if (fileStats.crlfCount > fileStats.lfCount) {
      preferences.lineEndingStyle = 'CRLF';
    } else {
      preferences.lineEndingStyle = 'LF';
    }
    
    // Determine naming conventions
    preferences.namingConventions = {
      variables: this.detectNamingConvention(fileStats.variableNames),
      functions: this.detectNamingConvention(fileStats.functionNames),
      classes: this.detectNamingConvention(fileStats.classNames),
      constants: this.detectNamingConvention(fileStats.constantNames)
    };
    
    // Determine code formatting preferences
    preferences.codeFormatting = {
      braceStyle: this.detectBraceStyle(fileStats.braceStyles),
      maxLineLength: fileStats.maxLineLength,
      trailingCommas: fileStats.trailingCommaCount > fileStats.noTrailingCommaCount,
      semicolons: fileStats.semicolonCount > fileStats.noSemicolonCount
    };
    
    // Determine preferred patterns
    preferences.preferredPatterns = this.detectPreferredPatterns(fileStats);
    
    return preferences;
  }

  /**
   * Map code ownership based on git history
   */
  async mapCodeOwnership(repositoryPath: string): Promise<Record<string, string[]>> {
    try {
      // Get git history
      const gitHistory = await this.analyzeGitHistory(repositoryPath);
      
      // Calculate code ownership
      return gitHistory.codeOwnership;
    } catch (error) {
      console.warn('Error mapping code ownership:', error);
      return {};
    }
  }

  /**
   * Identify developer specializations
   */
  async identifySpecializations(repositoryPath: string): Promise<Record<string, string[]>> {
    try {
      // Get git history
      const gitHistory = await this.analyzeGitHistory(repositoryPath);
      
      const specializations: Record<string, string[]> = {};
      
      // Analyze each author's contributions
      for (const author of gitHistory.authors) {
        const fileTypes = new Map<string, number>();
        const directories = new Map<string, number>();
        
        // Count file types and directories
        for (const file of author.filesModified) {
          // Get file extension
          const ext = path.extname(file).toLowerCase();
          if (ext) {
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
          }
          
          // Get directory
          const dir = path.dirname(file);
          if (dir && dir !== '.') {
            // Get top-level directory
            const topDir = dir.split('/')[0];
            directories.set(topDir, (directories.get(topDir) || 0) + 1);
          }
        }
        
        // Determine specializations
        const authorSpecializations: string[] = [];
        
        // Add file type specializations
        const sortedFileTypes = Array.from(fileTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        for (const [ext, count] of sortedFileTypes) {
          if (count >= 5) { // At least 5 files
            authorSpecializations.push(`${ext} files`);
          }
        }
        
        // Add directory specializations
        const sortedDirectories = Array.from(directories.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        for (const [dir, count] of sortedDirectories) {
          if (count >= 5) { // At least 5 files
            authorSpecializations.push(`${dir} directory`);
          }
        }
        
        // Add role-based specializations
        if (author.filesModified.some(file => file.includes('test') || file.includes('spec'))) {
          authorSpecializations.push('Testing');
        }
        
        if (author.filesModified.some(file => file.includes('docker') || file.includes('k8s') || file.includes('kubernetes'))) {
          authorSpecializations.push('DevOps');
        }
        
        if (author.filesModified.some(file => file.includes('ui') || file.includes('component') || file.includes('view'))) {
          authorSpecializations.push('Frontend');
        }
        
        if (author.filesModified.some(file => file.includes('api') || file.includes('controller') || file.includes('service'))) {
          authorSpecializations.push('Backend');
        }
        
        specializations[author.name] = authorSpecializations;
      }
      
      return specializations;
    } catch (error) {
      console.warn('Error identifying specializations:', error);
      return {};
    }
  }

  /**
   * Get capabilities of this analyzer
   */
  getCapabilities(): string[] {
    return [
      'git-history-analysis',
      'coding-style-detection',
      'team-preference-analysis',
      'code-ownership-mapping',
      'developer-specialization'
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
      operationName: 'team-analytics',
      executionTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Calculate commit frequency
   */
  private calculateCommitFrequency(authors: AuthorActivity[]): Record<string, number> {
    const frequency: Record<string, number> = {
      daily: 0,
      weekly: 0,
      monthly: 0,
      quarterly: 0
    };
    
    // Calculate project duration in days
    const firstCommit = Math.min(...authors.map(a => a.activeTimeSpan.first.getTime()));
    const lastCommit = Math.max(...authors.map(a => a.activeTimeSpan.last.getTime()));
    const durationDays = (lastCommit - firstCommit) / (1000 * 60 * 60 * 24);
    
    if (durationDays <= 0) {
      return frequency;
    }
    
    // Calculate total commits
    const totalCommits = authors.reduce((sum, author) => sum + author.commits, 0);
    
    // Calculate frequency
    const commitsPerDay = totalCommits / durationDays;
    
    frequency.daily = commitsPerDay;
    frequency.weekly = commitsPerDay * 7;
    frequency.monthly = commitsPerDay * 30;
    frequency.quarterly = commitsPerDay * 90;
    
    return frequency;
  }

  /**
   * Calculate code ownership
   */
  private calculateCodeOwnership(authors: AuthorActivity[]): Record<string, string[]> {
    const ownership: Record<string, string[]> = {};
    const fileAuthors: Record<string, Map<string, number>> = {};
    
    // Count file modifications by author
    for (const author of authors) {
      for (const file of author.filesModified) {
        if (!fileAuthors[file]) {
          fileAuthors[file] = new Map();
        }
        
        fileAuthors[file].set(author.name, (fileAuthors[file].get(author.name) || 0) + 1);
      }
    }
    
    // Determine primary owners (top 2 contributors)
    for (const [file, authorCounts] of Object.entries(fileAuthors)) {
      const sortedAuthors = Array.from(authorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 2); // Top 2 contributors
      
      ownership[file] = sortedAuthors;
    }
    
    return ownership;
  }

  /**
   * Analyze code files to detect coding preferences
   */
  private async analyzeCodeFiles(repositoryPath: string): Promise<{
    tabCount: number;
    spaceCount: number;
    indentSizes: Map<number, number>;
    lfCount: number;
    crlfCount: number;
    variableNames: string[];
    functionNames: string[];
    classNames: string[];
    constantNames: string[];
    braceStyles: string[];
    maxLineLength: number;
    trailingCommaCount: number;
    noTrailingCommaCount: number;
    semicolonCount: number;
    noSemicolonCount: number;
  }> {
    const result = {
      tabCount: 0,
      spaceCount: 0,
      indentSizes: new Map<number, number>(),
      lfCount: 0,
      crlfCount: 0,
      variableNames: [] as string[],
      functionNames: [] as string[],
      classNames: [] as string[],
      constantNames: [] as string[],
      braceStyles: [] as string[],
      maxLineLength: 0,
      trailingCommaCount: 0,
      noTrailingCommaCount: 0,
      semicolonCount: 0,
      noSemicolonCount: 0
    };
    
    // Define patterns for code analysis
    const patterns = {
      variable: /(?:let|var|const)\s+(\w+)\s*=/,
      function: /function\s+(\w+)\s*\(/,
      class: /class\s+(\w+)/,
      constant: /const\s+([A-Z_][A-Z0-9_]*)\s*=/,
      sameLine: /\)\s*{/,
      newLine: /\)\s*\n\s*{/,
      trailingComma: /,\s*[}\]]/,
      noTrailingComma: /[^,]\s*[}\]]/,
      semicolon: /;\s*$/,
      noSemicolon: /[^;]\s*$/
    };
    
    // Extensions to analyze
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.cs'];
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        
        // Skip if not a relevant file extension
        if (!extensions.includes(ext)) {
          return;
        }
        
        try {
          // Read file content
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          
          // Check for tabs vs spaces
          const tabMatch = content.match(/^\t+/mg);
          const spaceMatch = content.match(/^ +/mg);
          
          if (tabMatch) {
            result.tabCount += tabMatch.length;
          }
          
          if (spaceMatch) {
            result.spaceCount += spaceMatch.length;
            
            // Analyze indent sizes
            for (const indent of spaceMatch) {
              const size = indent.length;
              result.indentSizes.set(size, (result.indentSizes.get(size) || 0) + 1);
            }
          }
          
          // Check for line endings
          if (content.includes('\r\n')) {
            result.crlfCount++;
          } else {
            result.lfCount++;
          }
          
          // Check for max line length
          for (const line of lines) {
            result.maxLineLength = Math.max(result.maxLineLength, line.length);
          }
          
          // Extract naming conventions
          const variableMatches = content.match(new RegExp(patterns.variable, 'g'));
          const functionMatches = content.match(new RegExp(patterns.function, 'g'));
          const classMatches = content.match(new RegExp(patterns.class, 'g'));
          const constantMatches = content.match(new RegExp(patterns.constant, 'g'));
          
          if (variableMatches) {
            for (const match of variableMatches) {
              const name = match.match(patterns.variable)?.[1];
              if (name) {
                result.variableNames.push(name);
              }
            }
          }
          
          if (functionMatches) {
            for (const match of functionMatches) {
              const name = match.match(patterns.function)?.[1];
              if (name) {
                result.functionNames.push(name);
              }
            }
          }
          
          if (classMatches) {
            for (const match of classMatches) {
              const name = match.match(patterns.class)?.[1];
              if (name) {
                result.classNames.push(name);
              }
            }
          }
          
          if (constantMatches) {
            for (const match of constantMatches) {
              const name = match.match(patterns.constant)?.[1];
              if (name) {
                result.constantNames.push(name);
              }
            }
          }
          
          // Check brace style
          const sameLineMatches = content.match(new RegExp(patterns.sameLine, 'g'));
          const newLineMatches = content.match(new RegExp(patterns.newLine, 'g'));
          
          if (sameLineMatches) {
            for (let i = 0; i < sameLineMatches.length; i++) {
              result.braceStyles.push('same-line');
            }
          }
          
          if (newLineMatches) {
            for (let i = 0; i < newLineMatches.length; i++) {
              result.braceStyles.push('new-line');
            }
          }
          
          // Check trailing commas
          const trailingCommaMatches = content.match(new RegExp(patterns.trailingComma, 'g'));
          const noTrailingCommaMatches = content.match(new RegExp(patterns.noTrailingComma, 'g'));
          
          if (trailingCommaMatches) {
            result.trailingCommaCount += trailingCommaMatches.length;
          }
          
          if (noTrailingCommaMatches) {
            result.noTrailingCommaCount += noTrailingCommaMatches.length;
          }
          
          // Check semicolons
          const semicolonMatches = content.match(new RegExp(patterns.semicolon, 'mg'));
          const noSemicolonMatches = content.match(new RegExp(patterns.noSemicolon, 'mg'));
          
          if (semicolonMatches) {
            result.semicolonCount += semicolonMatches.length;
          }
          
          if (noSemicolonMatches) {
            result.noSemicolonCount += noSemicolonMatches.length;
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
    );
    
    return result;
  }

  /**
   * Detect naming convention from a list of names
   */
  private detectNamingConvention(names: string[]): string {
    if (names.length === 0) {
      return 'unknown';
    }
    
    let camelCaseCount = 0;
    let pascalCaseCount = 0;
    let snakeCaseCount = 0;
    let kebabCaseCount = 0;
    
    for (const name of names) {
      if (/^[a-z][a-zA-Z0-9]*$/.test(name) && name.includes(/[A-Z]/.test(name) ? 'A' : 'x')) {
        camelCaseCount++;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        pascalCaseCount++;
      } else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) {
        snakeCaseCount++;
      } else if (/^[a-z][a-z0-9-]*$/.test(name) && name.includes('-')) {
        kebabCaseCount++;
      }
    }
    
    const counts = [
      { convention: 'camelCase', count: camelCaseCount },
      { convention: 'PascalCase', count: pascalCaseCount },
      { convention: 'snake_case', count: snakeCaseCount },
      { convention: 'kebab-case', count: kebabCaseCount }
    ];
    
    counts.sort((a, b) => b.count - a.count);
    
    if (counts[0].count > 0) {
      return counts[0].convention;
    }
    
    return 'mixed';
  }

  /**
   * Detect brace style from a list of brace styles
   */
  private detectBraceStyle(styles: string[]): string {
    if (styles.length === 0) {
      return 'unknown';
    }
    
    let sameLineCount = 0;
    let newLineCount = 0;
    
    for (const style of styles) {
      if (style === 'same-line') {
        sameLineCount++;
      } else if (style === 'new-line') {
        newLineCount++;
      }
    }
    
    if (sameLineCount > newLineCount) {
      return 'same-line';
    } else if (newLineCount > sameLineCount) {
      return 'new-line';
    }
    
    return 'mixed';
  }

  /**
   * Detect preferred patterns from code analysis
   */
  private detectPreferredPatterns(fileStats: any): string[] {
    const patterns: string[] = [];
    
    // Indentation preference
    patterns.push(`Uses ${fileStats.indentationStyle} for indentation`);
    
    // Line ending preference
    patterns.push(`Prefers ${fileStats.lineEndingStyle} line endings`);
    
    // Brace style
    const braceStyle = this.detectBraceStyle(fileStats.braceStyles);
    if (braceStyle !== 'unknown' && braceStyle !== 'mixed') {
      patterns.push(`Uses ${braceStyle} brace style`);
    }
    
    // Trailing commas
    if (fileStats.trailingCommaCount > fileStats.noTrailingCommaCount) {
      patterns.push('Uses trailing commas');
    } else {
      patterns.push('Avoids trailing commas');
    }
    
    // Semicolons
    if (fileStats.semicolonCount > fileStats.noSemicolonCount) {
      patterns.push('Uses semicolons');
    } else {
      patterns.push('Avoids semicolons');
    }
    
    return patterns;
  }

  /**
   * Get time of day preferences for an author
   */
  private getTimeOfDayPreferences(author: AuthorActivity