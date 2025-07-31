/**
 * MegaLinter Orchestrator - Main coordination engine for MegaLinter integration
 * Replaces the Trunk-focused approach with MegaLinter's 400+ linter ecosystem
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import {
  MegaLinterOrchestrator as IMegaLinterOrchestrator,
  LanguageProfile,
  UserPreferences,
  LinterConfiguration,
  MegaLinterConfiguration,
  LintingResults,
  LintingEvent,
  ProgressUpdate,
  ValidationResult,
  DockerConfiguration,
  RepositoryContext,
  LinterResult,
  LinterIssue,
  LintingSummary,
  PerformanceMetrics
} from './types';
import { RepositoryProfiler } from './profiler';
import { ConfigurationGenerator } from './configGenerator';

export class MegaLinterOrchestrator implements IMegaLinterOrchestrator {
  private readonly profiler: RepositoryProfiler;
  private readonly configGenerator: ConfigurationGenerator;
  private readonly eventEmitter = new vscode.EventEmitter<LintingEvent>();
  private currentExecution?: ChildProcess;
  private executionId = 0;

  public readonly onLintingEvent = this.eventEmitter.event;

  constructor() {
    this.profiler = new RepositoryProfiler();
    this.configGenerator = new ConfigurationGenerator();
  }

  /**
   * Detects languages and frameworks in the repository
   */
  async detectLanguages(repositoryPath: string): Promise<LanguageProfile> {
    try {
      this.emitEvent('started', { phase: 'language_detection' });
      
      const profile = await this.profiler.analyzeRepository(repositoryPath);
      
      this.emitEvent('progress', { 
        phase: 'language_detection',
        completed: true,
        profile 
      });

      return profile;
    } catch (error) {
      this.emitEvent('failed', { 
        phase: 'language_detection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Selects optimal linters based on language profile and user preferences
   */
  async selectLinters(profile: LanguageProfile, preferences: UserPreferences): Promise<LinterConfiguration[]> {
    try {
      this.emitEvent('started', { phase: 'linter_selection' });
      
      const linters = await this.configGenerator.selectOptimalLinters(profile);
      
      this.emitEvent('progress', { 
        phase: 'linter_selection',
        completed: true,
        linterCount: linters.length
      });

      return linters;
    } catch (error) {
      this.emitEvent('failed', { 
        phase: 'linter_selection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generates complete MegaLinter configuration
   */
  async generateConfiguration(profile: LanguageProfile, linters: LinterConfiguration[]): Promise<MegaLinterConfiguration> {
    try {
      this.emitEvent('started', { phase: 'configuration_generation' });
      
      // Use default preferences if not provided
      const defaultPreferences: UserPreferences = {
        severityThreshold: 'warning',
        performanceProfile: 'balanced',
        reportingPreferences: {
          format: 'json' as any,
          includePassingFiles: false,
          detailLevel: 'standard',
          realTimeUpdates: true
        },
        securityPreferences: {
          enableSecurityScanning: true,
          secretsDetection: true,
          vulnerabilityScanning: true,
          licenseChecking: false
        }
      };

      const config = await this.configGenerator.generateConfiguration(profile, defaultPreferences);
      
      this.emitEvent('progress', { 
        phase: 'configuration_generation',
        completed: true,
        config
      });

      return config;
    } catch (error) {
      this.emitEvent('failed', { 
        phase: 'configuration_generation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Executes MegaLinter with the provided configuration
   */
  async executeLinting(config: MegaLinterConfiguration, repositoryPath: string): Promise<LintingResults> {
    const executionId = (++this.executionId).toString();
    const startTime = Date.now();
    
    try {
      this.emitEvent('started', { executionId, phase: 'linting_execution' });
      
      // Validate Docker availability
      await this.validateDockerAvailability();
      
      // Create repository context
      const repositoryContext = await this.createRepositoryContext(repositoryPath);
      
      // Write MegaLinter configuration file
      await this.writeMegaLinterConfig(config, repositoryPath);
      
      // Execute MegaLinter via Docker
      const dockerConfig = this.createDockerConfiguration(repositoryPath);
      const results = await this.runMegaLinterDocker(dockerConfig, config, executionId);
      
      // Parse results
      const lintingResults: LintingResults = {
        executionId,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        repository: repositoryContext,
        configuration: config,
        results: results.linterResults,
        summary: results.summary,
        performance: results.performance
      };
      
      this.emitEvent('completed', { executionId, results: lintingResults });
      
      return lintingResults;
      
    } catch (error) {
      this.emitEvent('failed', { 
        executionId,
        phase: 'linting_execution',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Optimizes MegaLinter configuration for performance
   */
  async optimizePerformance(config: MegaLinterConfiguration): Promise<MegaLinterConfiguration> {
    try {
      this.emitEvent('started', { phase: 'performance_optimization' });
      
      const optimizedConfig = await this.configGenerator.validateAndOptimize(config);
      
      this.emitEvent('progress', { 
        phase: 'performance_optimization',
        completed: true,
        optimizations: this.getOptimizationSummary(config, optimizedConfig)
      });

      return optimizedConfig;
    } catch (error) {
      this.emitEvent('failed', { 
        phase: 'performance_optimization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validates MegaLinter configuration
   */
  async validateConfiguration(config: MegaLinterConfiguration): Promise<ValidationResult> {
    try {
      return await this.configGenerator.validateConfiguration(config);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          field: 'configuration',
          severity: 'error'
        }],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Cancels current linting execution
   */
  async cancelExecution(): Promise<void> {
    if (this.currentExecution) {
      this.currentExecution.kill('SIGTERM');
      this.currentExecution = undefined;
      this.emitEvent('cancelled', { executionId: this.executionId.toString() });
    }
  }

  /**
   * Gets MegaLinter status and health information
   */
  async getStatus(): Promise<{
    dockerAvailable: boolean;
    megalinterVersion?: string;
    lastExecution?: Date;
    health: 'healthy' | 'warning' | 'error';
  }> {
    try {
      const dockerAvailable = await this.checkDockerAvailability();
      let megalinterVersion: string | undefined;
      
      if (dockerAvailable) {
        megalinterVersion = await this.getMegaLinterVersion();
      }

      return {
        dockerAvailable,
        megalinterVersion,
        health: dockerAvailable ? 'healthy' : 'error'
      };
    } catch (error) {
      return {
        dockerAvailable: false,
        health: 'error'
      };
    }
  }

  // Private helper methods

  private async validateDockerAvailability(): Promise<void> {
    const isAvailable = await this.checkDockerAvailability();
    if (!isAvailable) {
      throw new Error('Docker is not available. MegaLinter requires Docker to run.');
    }
  }

  private async checkDockerAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['--version'], { stdio: 'pipe' });
      
      docker.on('close', (code) => {
        resolve(code === 0);
      });
      
      docker.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        docker.kill();
        resolve(false);
      }, 5000);
    });
  }

  private async getMegaLinterVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', [
        'run', '--rm', 'oxsecurity/megalinter:latest', '--version'
      ], { stdio: 'pipe' });
      
      let output = '';
      docker.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      docker.on('close', (code) => {
        if (code === 0) {
          const version = output.match(/v?(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
          resolve(version);
        } else {
          reject(new Error(`Failed to get MegaLinter version: exit code ${code}`));
        }
      });
      
      docker.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        docker.kill();
        reject(new Error('Timeout getting MegaLinter version'));
      }, 30000);
    });
  }

  private async createRepositoryContext(repositoryPath: string): Promise<RepositoryContext> {
    // Try to get git remote information
    let gitRemote: string | undefined;
    let organization: string | undefined;
    let repository: string | undefined;
    
    try {
      const gitConfigPath = path.join(repositoryPath, '.git', 'config');
      if (fs.existsSync(gitConfigPath)) {
        const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
        const remoteMatch = gitConfig.match(/url = (https:\/\/github\.com\/[^\/]+\/[^\/\s]+)/);
        if (remoteMatch) {
          gitRemote = remoteMatch[1];
          const urlParts = gitRemote.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\s]+)/);
          if (urlParts) {
            organization = urlParts[1];
            repository = urlParts[2].replace('.git', '');
          }
        }
      }
    } catch (error) {
      // Git info is optional
    }

    // Detect package manager
    let packageManager: any;
    if (fs.existsSync(path.join(repositoryPath, 'package.json'))) {
      if (fs.existsSync(path.join(repositoryPath, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else if (fs.existsSync(path.join(repositoryPath, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      } else {
        packageManager = 'npm';
      }
    } else if (fs.existsSync(path.join(repositoryPath, 'pom.xml'))) {
      packageManager = 'maven';
    } else if (fs.existsSync(path.join(repositoryPath, 'build.gradle'))) {
      packageManager = 'gradle';
    } else if (fs.existsSync(path.join(repositoryPath, 'requirements.txt'))) {
      packageManager = 'pip';
    } else if (fs.existsSync(path.join(repositoryPath, 'Cargo.toml'))) {
      packageManager = 'cargo';
    } else if (fs.existsSync(path.join(repositoryPath, 'go.mod'))) {
      packageManager = 'go';
    }

    return {
      rootPath: repositoryPath,
      gitRemote,
      organization,
      repository,
      packageManager,
      lastAnalyzed: new Date()
    };
  }

  private async writeMegaLinterConfig(config: MegaLinterConfiguration, repositoryPath: string): Promise<void> {
    const configYaml = await this.configGenerator.exportToYaml(config);
    const configPath = path.join(repositoryPath, '.mega-linter.yml');
    
    fs.writeFileSync(configPath, configYaml, 'utf8');
  }

  private createDockerConfiguration(repositoryPath: string): DockerConfiguration {
    return {
      image: 'oxsecurity/megalinter',
      tag: 'latest',
      volumes: [
        {
          hostPath: repositoryPath,
          containerPath: '/tmp/lint',
          readOnly: false
        }
      ],
      environment: {
        'DEFAULT_WORKSPACE': '/tmp/lint',
        'MEGALINTER_CONFIG': '.mega-linter.yml',
        'LOG_LEVEL': 'INFO',
        'ENABLE_LINTERS': 'true'
      },
      workingDirectory: '/tmp/lint',
      memoryLimit: '2GB',
      cpuLimit: 2.0
    };
  }

  private async runMegaLinterDocker(
    dockerConfig: DockerConfiguration, 
    config: MegaLinterConfiguration,
    executionId: string
  ): Promise<{
    linterResults: LinterResult[];
    summary: LintingSummary;
    performance: PerformanceMetrics;
  }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Build Docker command
      const dockerArgs = [
        'run', '--rm',
        '--memory', dockerConfig.memoryLimit || '2GB',
        '--cpus', dockerConfig.cpuLimit?.toString() || '2.0',
        '-w', dockerConfig.workingDirectory
      ];

      // Add environment variables
      for (const [key, value] of Object.entries(dockerConfig.environment)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }

      // Add volume mounts
      for (const volume of dockerConfig.volumes) {
        dockerArgs.push('-v', `${volume.hostPath}:${volume.containerPath}${volume.readOnly ? ':ro' : ''}`);
      }

      // Add image
      dockerArgs.push(`${dockerConfig.image}:${dockerConfig.tag}`);

      // Execute Docker command
      const docker = spawn('docker', dockerArgs, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dockerConfig.volumes[0].hostPath
      });

      this.currentExecution = docker;
      
      let stdout = '';
      let stderr = '';
      
      docker.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.emitProgressUpdate(executionId, data.toString());
      });
      
      docker.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      docker.on('close', (code) => {
        this.currentExecution = undefined;
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (code === 0) {
          try {
            const results = this.parseMegaLinterOutput(stdout, stderr, duration);
            resolve(results);
          } catch (parseError) {
            reject(new Error(`Failed to parse MegaLinter output: ${parseError}`));
          }
        } else {
          reject(new Error(`MegaLinter execution failed with exit code ${code}. Error: ${stderr}`));
        }
      });
      
      docker.on('error', (error) => {
        this.currentExecution = undefined;
        reject(new Error(`Docker execution error: ${error.message}`));
      });
      
      // Set execution timeout
      setTimeout(() => {
        if (this.currentExecution) {
          this.currentExecution.kill('SIGTERM');
          reject(new Error('MegaLinter execution timed out'));
        }
      }, config.performance.maxExecutionTime);
    });
  }

  private parseMegaLinterOutput(stdout: string, stderr: string, duration: number): {
    linterResults: LinterResult[];
    summary: LintingSummary;
    performance: PerformanceMetrics;
  } {
    // This is a simplified parser - in practice, you'd parse the actual MegaLinter JSON output
    // MegaLinter produces detailed JSON reports that we would parse here
    
    const linterResults: LinterResult[] = [];
    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    
    // Try to parse JSON output if available
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        // Parse actual MegaLinter JSON structure here
        // This is placeholder logic
      }
    } catch (error) {
      // Fallback to text parsing
    }
    
    // Extract basic metrics from output
    const issueMatches = stdout.match(/(\d+) issue\(s\) found/g) || [];
    totalIssues = issueMatches.reduce((sum, match) => {
      const count = parseInt(match.match(/(\d+)/)?.[1] || '0', 10);
      return sum + count;
    }, 0);

    const summary: LintingSummary = {
      totalFiles: this.extractMetric(stdout, /Scanned (\d+) files/) || 0,
      totalIssues,
      errorCount,
      warningCount,
      infoCount,
      fixableCount: this.extractMetric(stdout, /(\d+) fixable/) || 0,
      lintersExecuted: this.extractMetric(stdout, /Executed (\d+) linters/) || 0,
      lintersSucceeded: this.extractMetric(stdout, /(\d+) succeeded/) || 0,
      lintersFailed: this.extractMetric(stdout, /(\d+) failed/) || 0
    };

    const performance: PerformanceMetrics = {
      totalExecutionTime: duration,
      linterExecutionTimes: {},
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    return {
      linterResults,
      summary,
      performance
    };
  }

  private extractMetric(text: string, regex: RegExp): number | null {
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }

  private emitProgressUpdate(executionId: string, output: string): void {
    // Parse progress information from MegaLinter output
    const linterMatch = output.match(/Running (\w+)/);
    if (linterMatch) {
      const progress: ProgressUpdate = {
        completedLinters: 0,
        totalLinters: 0,
        currentLinter: linterMatch[1],
        estimatedTimeRemaining: 0
      };
      
      this.emitEvent('progress', { executionId, progress });
    }
  }

  private getOptimizationSummary(original: MegaLinterConfiguration, optimized: MegaLinterConfiguration): string[] {
    const optimizations: string[] = [];
    
    if (original.performance.parallelism !== optimized.performance.parallelism) {
      optimizations.push(`Adjusted parallelism from ${original.performance.parallelism} to ${optimized.performance.parallelism}`);
    }
    
    if (original.performance.cacheStrategy !== optimized.performance.cacheStrategy) {
      optimizations.push(`Changed cache strategy from ${original.performance.cacheStrategy} to ${optimized.performance.cacheStrategy}`);
    }
    
    if (original.linters.enabled.length !== optimized.linters.enabled.length) {
      const diff = optimized.linters.enabled.length - original.linters.enabled.length;
      optimizations.push(`${diff > 0 ? 'Added' : 'Removed'} ${Math.abs(diff)} linter(s)`);
    }
    
    return optimizations;
  }

  private emitEvent(type: LintingEvent['type'], data?: any): void {
    const event: LintingEvent = {
      type,
      timestamp: new Date(),
      executionId: this.executionId.toString(),
      data
    };
    
    this.eventEmitter.fire(event);
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    if (this.currentExecution) {
      this.currentExecution.kill('SIGTERM');
    }
    this.eventEmitter.dispose();
  }
}