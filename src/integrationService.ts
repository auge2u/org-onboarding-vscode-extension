/**
 * Integration Service - Bridges MegaLinter and GitHub Actions capabilities
 * Provides unified interface for local and remote linting operations
 */

import * as vscode from 'vscode';
import { MegaLinterOrchestrator } from './megalinter/orchestrator';
import { CICDOrchestrator, CICDOrchestrationOptions } from './github/cicdOrchestrator';
import { WorkflowGenerator } from './github/workflowGenerator';
import { 
  LanguageProfile, 
  UserPreferences, 
  LintingResults,
  MegaLinterConfiguration 
} from './megalinter/types';
import { MegaLinterWorkflowResult } from './githubActionsApi';

export interface IntegrationServiceOptions {
  repositoryPath: string;
  githubToken?: string;
  organization?: string;
  repository?: string;
  preferences?: UserPreferences;
}

export interface ExecutionOptions {
  mode: 'local' | 'remote' | 'hybrid';
  profile?: 'fast' | 'balanced' | 'thorough';
  autoSync?: boolean;
  monitorProgress?: boolean;
}

export interface IntegrationStatus {
  localAvailable: boolean;
  remoteConfigured: boolean;
  syncStatus: 'synced' | 'drift' | 'conflict' | 'unknown';
  lastExecution?: {
    local?: Date;
    remote?: Date;
  };
  health: 'healthy' | 'warning' | 'error';
  recommendations: string[];
}

export class IntegrationService {
  private readonly megalinterOrchestrator: MegaLinterOrchestrator;
  private readonly cicdOrchestrator: CICDOrchestrator;
  private readonly workflowGenerator: WorkflowGenerator;
  private readonly eventEmitter = new vscode.EventEmitter<{
    type: 'execution_started' | 'execution_completed' | 'status_changed' | 'recommendation_available';
    data: any;
  }>();

  public readonly onEvent = this.eventEmitter.event;

  constructor() {
    this.megalinterOrchestrator = new MegaLinterOrchestrator();
    this.cicdOrchestrator = new CICDOrchestrator();
    this.workflowGenerator = new WorkflowGenerator();

    this.setupEventForwarding();
  }

  /**
   * Executes MegaLinter analysis with specified mode
   */
  async execute(
    options: IntegrationServiceOptions,
    executionOptions: ExecutionOptions = { mode: 'hybrid' }
  ): Promise<{
    success: boolean;
    localResults?: LintingResults;
    remoteResults?: MegaLinterWorkflowResult;
    summary: {
      totalIssues: number;
      executionTime: number;
      mode: string;
    };
    recommendations?: string[];
  }> {
    try {
      this.eventEmitter.fire({ 
        type: 'execution_started', 
        data: { mode: executionOptions.mode, options }
      });

      const result: any = { success: false, summary: { totalIssues: 0, executionTime: 0, mode: executionOptions.mode } };
      const startTime = Date.now();

      switch (executionOptions.mode) {
        case 'local':
          result.localResults = await this.executeLocal(options, executionOptions);
          result.summary.totalIssues = result.localResults.summary.totalIssues;
          break;

        case 'remote':
          if (!this.isRemoteConfigured(options)) {
            throw new Error('Remote execution requires GitHub token, organization, and repository');
          }
          result.remoteResults = await this.executeRemote(options, executionOptions);
          result.summary.totalIssues = result.remoteResults.summary.totalIssues;
          break;

        case 'hybrid':
          const hybridResults = await this.executeHybrid(options, executionOptions);
          result.localResults = hybridResults.localResults;
          result.remoteResults = hybridResults.remoteResults;
          result.comparison = hybridResults.comparison;
          
          // Use local results as primary, fall back to remote
          result.summary.totalIssues = result.localResults?.summary.totalIssues || 
                                      result.remoteResults?.summary.totalIssues || 0;
          break;

        default:
          throw new Error(`Unsupported execution mode: ${executionOptions.mode}`);
      }

      result.summary.executionTime = Date.now() - startTime;
      result.success = true;

      // Generate recommendations based on results
      if (this.isRemoteConfigured(options)) {
        result.recommendations = await this.generateRecommendations(options, result);
      }

      this.eventEmitter.fire({ 
        type: 'execution_completed', 
        data: { success: true, result }
      });

      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        summary: { 
          totalIssues: 0, 
          executionTime: Date.now() - Date.now(), 
          mode: executionOptions.mode 
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.eventEmitter.fire({ 
        type: 'execution_completed', 
        data: { success: false, error: errorResult.error }
      });

      return errorResult;
    }
  }

  /**
   * Sets up GitHub Actions workflow for the repository
   */
  async setupWorkflow(
    options: IntegrationServiceOptions,
    workflowOptions: {
      template?: 'basic' | 'enterprise' | 'security' | 'performance';
      autoTrigger?: boolean;
      monitorProgress?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    workflowPath?: string;
    workflowUrl?: string;
    errors?: string[];
  }> {
    try {
      if (!this.isRemoteConfigured(options)) {
        throw new Error('Workflow setup requires GitHub token, organization, and repository');
      }

      const cicdOptions: CICDOrchestrationOptions = {
        repositoryPath: options.repositoryPath,
        githubToken: options.githubToken!,
        organization: options.organization!,
        repository: options.repository!,
        preferences: options.preferences,
        autoTrigger: workflowOptions.autoTrigger,
        monitorProgress: workflowOptions.monitorProgress
      };

      const orchestrationResult = await this.cicdOrchestrator.orchestrateCI(cicdOptions);

      if (orchestrationResult.deployment.success) {
        this.eventEmitter.fire({
          type: 'status_changed',
          data: { type: 'workflow_setup', success: true }
        });
      }

      return {
        success: orchestrationResult.deployment.success,
        workflowPath: orchestrationResult.deployment.workflowPath,
        workflowUrl: orchestrationResult.deployment.workflowUrl,
        errors: orchestrationResult.deployment.errors
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Gets comprehensive integration status
   */
  async getStatus(options: IntegrationServiceOptions): Promise<IntegrationStatus> {
    try {
      const localStatus = await this.megalinterOrchestrator.getStatus();
      const recommendations: string[] = [];

      let remoteConfigured = false;
      let syncStatus: IntegrationStatus['syncStatus'] = 'unknown';
      let health: IntegrationStatus['health'] = 'healthy';

      if (this.isRemoteConfigured(options)) {
        remoteConfigured = true;
        const cicdOptions: CICDOrchestrationOptions = {
          repositoryPath: options.repositoryPath,
          githubToken: options.githubToken!,
          organization: options.organization!,
          repository: options.repository!,
          preferences: options.preferences
        };

        const integrationStatus = await this.cicdOrchestrator.getIntegrationStatus(cicdOptions);
        syncStatus = integrationStatus.syncStatus;
        recommendations.push(...integrationStatus.recommendations);

        if (integrationStatus.remoteStatus.workflowHealth === 'error') {
          health = 'error';
        } else if (integrationStatus.remoteStatus.workflowHealth === 'warning' || syncStatus === 'drift') {
          health = 'warning';
        }
      }

      if (!localStatus.dockerAvailable) {
        health = 'warning';
        recommendations.push('Docker is not available - local execution disabled');
      }

      if (!remoteConfigured) {
        recommendations.push('Configure GitHub integration for remote workflow execution');
      }

      return {
        localAvailable: localStatus.dockerAvailable,
        remoteConfigured,
        syncStatus,
        health,
        recommendations
      };
    } catch (error) {
      return {
        localAvailable: false,
        remoteConfigured: false,
        syncStatus: 'unknown',
        health: 'error',
        recommendations: [`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Synchronizes configuration between local and remote
   */
  async syncConfiguration(
    options: IntegrationServiceOptions,
    direction: 'local-to-remote' | 'remote-to-local' | 'bidirectional' = 'local-to-remote'
  ): Promise<{
    success: boolean;
    changes: string[];
    conflicts?: string[];
  }> {
    if (!this.isRemoteConfigured(options)) {
      return {
        success: false,
        changes: [],
        conflicts: ['Remote configuration not available - missing GitHub credentials']
      };
    }

    const cicdOptions: CICDOrchestrationOptions = {
      repositoryPath: options.repositoryPath,
      githubToken: options.githubToken!,
      organization: options.organization!,
      repository: options.repository!,
      preferences: options.preferences
    };

    return await this.cicdOrchestrator.syncConfigurationWithWorkflow(cicdOptions, direction);
  }

  /**
   * Generates intelligent recommendations based on repository analysis
   */
  async getRecommendations(options: IntegrationServiceOptions): Promise<{
    performance: string[];
    configuration: string[];
    workflow: string[];
    integration: string[];
  }> {
    if (!this.isRemoteConfigured(options)) {
      return {
        performance: ['Install Docker for local MegaLinter execution'],
        configuration: ['Analyze repository to generate optimal configuration'],
        workflow: ['Configure GitHub integration to enable workflow recommendations'],
        integration: ['Set up GitHub token for full integration capabilities']
      };
    }

    const cicdOptions: CICDOrchestrationOptions = {
      repositoryPath: options.repositoryPath,
      githubToken: options.githubToken!,
      organization: options.organization!,
      repository: options.repository!,
      preferences: options.preferences
    };

    return await this.cicdOrchestrator.getIntelligentRecommendations(cicdOptions);
  }

  // Private helper methods

  private async executeLocal(
    options: IntegrationServiceOptions,
    executionOptions: ExecutionOptions
  ): Promise<LintingResults> {
    const profile = await this.megalinterOrchestrator.detectLanguages(options.repositoryPath);
    const preferences = this.getExecutionPreferences(executionOptions, options.preferences);
    const linters = await this.megalinterOrchestrator.selectLinters(profile as any, preferences);
    const config = await this.megalinterOrchestrator.generateConfiguration(profile as any, linters);
    
    return await this.megalinterOrchestrator.executeLinting(config, options.repositoryPath);
  }

  private async executeRemote(
    options: IntegrationServiceOptions,
    executionOptions: ExecutionOptions
  ): Promise<MegaLinterWorkflowResult> {
    const cicdOptions: CICDOrchestrationOptions = {
      repositoryPath: options.repositoryPath,
      githubToken: options.githubToken!,
      organization: options.organization!,
      repository: options.repository!,
      preferences: options.preferences,
      autoTrigger: true,
      monitorProgress: executionOptions.monitorProgress
    };

    const result = await this.cicdOrchestrator.orchestrateCI(cicdOptions);
    
    if (!result.initialRun) {
      throw new Error('Failed to trigger remote workflow execution');
    }

    return result.initialRun;
  }

  private async executeHybrid(
    options: IntegrationServiceOptions,
    executionOptions: ExecutionOptions
  ): Promise<{
    localResults?: LintingResults;
    remoteResults?: MegaLinterWorkflowResult;
    comparison?: any;
  }> {
    const cicdOptions: CICDOrchestrationOptions = {
      repositoryPath: options.repositoryPath,
      githubToken: options.githubToken!,
      organization: options.organization!,
      repository: options.repository!,
      preferences: options.preferences,
      monitorProgress: executionOptions.monitorProgress
    };

    return await this.cicdOrchestrator.executeHybridLinting(cicdOptions, true, true);
  }

  private isRemoteConfigured(options: IntegrationServiceOptions): boolean {
    return !!(options.githubToken && options.organization && options.repository);
  }

  private getExecutionPreferences(
    executionOptions: ExecutionOptions,
    basePreferences?: UserPreferences
  ): UserPreferences {
    const preferences: UserPreferences = {
      severityThreshold: 'warning',
      performanceProfile: executionOptions.profile || 'balanced',
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
      },
      ...basePreferences
    };

    return preferences;
  }

  private async generateRecommendations(
    options: IntegrationServiceOptions,
    executionResult: any
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (executionResult.localResults?.summary.errorCount > 0) {
      recommendations.push(`${executionResult.localResults.summary.errorCount} errors found - review and fix critical issues`);
    }

    if (executionResult.comparison?.consistencyScore < 0.8) {
      recommendations.push('Local and remote results differ significantly - check configuration sync');
    }

    if (executionResult.summary.executionTime > 300000) { // > 5 minutes
      recommendations.push('Execution time is high - consider optimizing linter configuration');
    }

    return recommendations;
  }

  private setupEventForwarding(): void {
    // Forward events from orchestrators
    this.megalinterOrchestrator.onLintingEvent((event) => {
      this.eventEmitter.fire({
        type: 'status_changed',
        data: { source: 'local', event }
      });
    });

    this.cicdOrchestrator.onEvent((event) => {
      this.eventEmitter.fire({
        type: 'status_changed',
        data: { source: 'remote', event }
      });
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.megalinterOrchestrator.dispose();
    this.cicdOrchestrator.dispose();
    this.eventEmitter.dispose();
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();