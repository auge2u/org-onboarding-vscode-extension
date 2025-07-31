/**
 * CI/CD Orchestration Engine for MegaLinter Integration
 * Coordinates workflow automation, trigger management, and result synchronization
 */

import * as vscode from 'vscode';
import { MegaLinterOrchestrator } from '../megalinter/orchestrator';
import { RepositoryProfiler } from '../megalinter/profiler';
import { ConfigurationGenerator } from '../megalinter/configGenerator';
import { WorkflowGenerator, WorkflowGenerationOptions } from './workflowGenerator';
import { WorkflowTemplates } from './workflowTemplates';
import {
  createMegaLinterWorkflow,
  triggerMegaLinterWorkflow,
  getMegaLinterWorkflowResult,
  monitorWorkflowRun,
  getWorkflowRuns,
  cancelWorkflowRun,
  listWorkflows,
  WorkflowRun,
  MegaLinterWorkflowResult,
  WorkflowTemplate
} from '../githubActionsApi';
import {
  LanguageProfile,
  UserPreferences,
  MegaLinterConfiguration,
  LintingResults,
  RepositoryContext
} from '../megalinter/types';

export interface CICDOrchestrationOptions {
  repositoryPath: string;
  githubToken: string;
  organization: string;
  repository: string;
  preferences?: UserPreferences;
  autoTrigger?: boolean;
  monitorProgress?: boolean;
}

export interface WorkflowDeploymentResult {
  success: boolean;
  workflowPath: string;
  workflowUrl?: string;
  errors?: string[];
  warnings?: string[];
}

export interface CICDStatus {
  lastRun?: WorkflowRun;
  isRunning: boolean;
  hasActiveWorkflows: boolean;
  workflowHealth: 'healthy' | 'warning' | 'error' | 'unknown';
  lastSuccessfulRun?: Date;
  consecutiveFailures: number;
  recommendations: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  conditions?: AutomationCondition[];
}

export interface AutomationTrigger {
  type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'profile_change' | 'config_drift';
  branches?: string[];
  schedule?: string; // cron expression
  events?: string[];
}

export interface AutomationAction {
  type: 'run_workflow' | 'update_config' | 'create_issue' | 'send_notification';
  parameters: Record<string, any>;
}

export interface AutomationCondition {
  type: 'file_changed' | 'branch_protection' | 'compliance_status' | 'custom';
  value: any;
}

export class CICDOrchestrator {
  private readonly megalinterOrchestrator: MegaLinterOrchestrator;
  private readonly repositoryProfiler: RepositoryProfiler;
  private readonly configGenerator: ConfigurationGenerator;
  private readonly workflowGenerator: WorkflowGenerator;
  private readonly workflowTemplates: WorkflowTemplates;
  private readonly automationRules: Map<string, AutomationRule> = new Map();
  private readonly activeMonitors: Map<string, NodeJS.Timeout> = new Map();
  private readonly eventEmitter = new vscode.EventEmitter<{
    type: 'workflow_updated' | 'configuration_synced' | 'status_changed';
    data: any;
  }>();
  private lastLocalResults?: LintingResults;
  private lastWorkflowResults?: MegaLinterWorkflowResult;

  public readonly onEvent = this.eventEmitter.event;

  constructor() {
    this.megalinterOrchestrator = new MegaLinterOrchestrator();
    this.repositoryProfiler = new RepositoryProfiler();
    this.configGenerator = new ConfigurationGenerator();
    this.workflowGenerator = new WorkflowGenerator();
    this.workflowTemplates = new WorkflowTemplates();
    
    this.initializeDefaultAutomation();
    this.setupEventIntegration();
  }

  /**
   * Main orchestration method - sets up complete CI/CD pipeline
   */
  async orchestrateCI(options: CICDOrchestrationOptions): Promise<{
    deployment: WorkflowDeploymentResult;
    initialRun?: MegaLinterWorkflowResult;
    status: CICDStatus;
  }> {
    try {
      console.log('🚀 Starting CI/CD orchestration...');

      // Step 1: Analyze repository and generate optimal configuration
      const profile = await this.analyzeRepositoryForCI(options.repositoryPath);
      const megalinterConfig = await this.generateOptimalConfig(profile, options.preferences);

      // Step 2: Select and customize workflow template
      const workflowTemplate = await this.selectOptimalWorkflow(profile, options.preferences);
      const customizedWorkflow = await this.customizeWorkflowForRepository(
        workflowTemplate,
        profile,
        megalinterConfig,
        options
      );

      // Step 3: Deploy workflow to repository
      const deployment = await this.deployWorkflow(
        options.organization,
        options.repository,
        options.githubToken,
        customizedWorkflow
      );

      if (!deployment.success) {
        throw new Error(`Workflow deployment failed: ${deployment.errors?.join(', ')}`);
      }

      // Step 4: Set up automation rules
      await this.setupAutomationRules(options);

      // Step 5: Trigger initial run if requested
      let initialRun: MegaLinterWorkflowResult | undefined;
      if (options.autoTrigger) {
        initialRun = await this.triggerInitialRun(options);
      }

      // Step 6: Get current CI/CD status
      const status = await this.getCICDStatus(options);

      // Step 7: Set up monitoring if requested
      if (options.monitorProgress && initialRun) {
        this.startWorkflowMonitoring(options, initialRun.run.id);
      }

      console.log('✅ CI/CD orchestration completed successfully');

      return {
        deployment,
        initialRun,
        status
      };
    } catch (error) {
      console.error('❌ CI/CD orchestration failed:', error);
      throw error;
    }
  }

  /**
   * Updates existing CI/CD configuration based on repository changes
   */
  async updateCIConfiguration(
    options: CICDOrchestrationOptions,
    changes: {
      profileChanged?: boolean;
      preferencesChanged?: boolean;
      configurationChanged?: boolean;
    }
  ): Promise<WorkflowDeploymentResult> {
    try {
      console.log('🔄 Updating CI/CD configuration...');

      if (changes.profileChanged || changes.configurationChanged) {
        // Re-analyze repository
        const profile = await this.analyzeRepositoryForCI(options.repositoryPath);
        const megalinterConfig = await this.generateOptimalConfig(profile, options.preferences);

        // Generate updated workflow
        const workflowTemplate = await this.selectOptimalWorkflow(profile, options.preferences);
        const updatedWorkflow = await this.customizeWorkflowForRepository(
          workflowTemplate,
          profile,
          megalinterConfig,
          options
        );

        // Deploy updated workflow
        return await this.deployWorkflow(
          options.organization,
          options.repository,
          options.githubToken,
          updatedWorkflow,
          'Update MegaLinter workflow configuration'
        );
      }

      if (changes.preferencesChanged) {
        // Update automation rules
        await this.updateAutomationRules(options);
      }

      return {
        success: true,
        workflowPath: '.github/workflows/megalinter.yml'
      };
    } catch (error) {
      return {
        success: false,
        workflowPath: '.github/workflows/megalinter.yml',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Gets comprehensive CI/CD status and health information
   */
  async getCICDStatus(options: CICDOrchestrationOptions): Promise<CICDStatus> {
    try {
      // Get recent workflow runs
      const runs = await getWorkflowRuns(
        options.organization,
        options.repository,
        options.githubToken,
        undefined,
        10
      );

      const lastRun = runs.workflow_runs[0];
      const isRunning = lastRun?.status === 'in_progress' || lastRun?.status === 'queued';
      
      // Check for active workflows
      const workflows = await listWorkflows(options.organization, options.repository, options.githubToken);
      const hasActiveWorkflows = workflows.workflows.length > 0;

      // Analyze workflow health
      const recentRuns = runs.workflow_runs.slice(0, 5);
      const failedRuns = recentRuns.filter(run => run.conclusion === 'failure');
      const consecutiveFailures = this.countConsecutiveFailures(recentRuns);
      
      let workflowHealth: CICDStatus['workflowHealth'] = 'healthy';
      if (consecutiveFailures >= 3) {
        workflowHealth = 'error';
      } else if (consecutiveFailures >= 1 || failedRuns.length > recentRuns.length / 2) {
        workflowHealth = 'warning';
      } else if (!hasActiveWorkflows) {
        workflowHealth = 'unknown';
      }

      // Find last successful run
      const lastSuccessfulRun = runs.workflow_runs
        .find(run => run.conclusion === 'success')?.updated_at;

      // Generate recommendations
      const recommendations = this.generateCICDRecommendations(
        recentRuns,
        consecutiveFailures,
        hasActiveWorkflows
      );

      return {
        lastRun,
        isRunning,
        hasActiveWorkflows,
        workflowHealth,
        lastSuccessfulRun: lastSuccessfulRun ? new Date(lastSuccessfulRun) : undefined,
        consecutiveFailures,
        recommendations
      };
    } catch (error) {
      return {
        isRunning: false,
        hasActiveWorkflows: false,
        workflowHealth: 'unknown',
        consecutiveFailures: 0,
        recommendations: ['Unable to retrieve CI/CD status. Check GitHub token permissions.']
      };
    }
  }

  /**
   * Monitors workflow execution with real-time updates
   */
  async monitorWorkflow(
    options: CICDOrchestrationOptions,
    runId: number,
    onProgress?: (result: MegaLinterWorkflowResult) => void
  ): Promise<MegaLinterWorkflowResult> {
    return await monitorWorkflowRun(
      options.organization,
      options.repository,
      options.githubToken,
      runId,
      (run, jobs) => {
        if (onProgress) {
          // Create a simplified result for progress updates
          const progressResult: MegaLinterWorkflowResult = {
            run,
            jobs,
            artifacts: [],
            summary: {
              totalIssues: 0,
              errorCount: jobs.filter(job => job.conclusion === 'failure').length,
              warningCount: 0,
              fixableCount: 0,
              lintersExecuted: jobs.length,
              duration: Date.now() - new Date(run.created_at).getTime()
            }
          };
          onProgress(progressResult);
        }
      }
    );
  }

  /**
   * Cancels running workflows
   */
  async cancelRunningWorkflows(options: CICDOrchestrationOptions): Promise<number> {
    try {
      const runs = await getWorkflowRuns(
        options.organization,
        options.repository,
        options.githubToken,
        undefined,
        10,
        1,
        'in_progress'
      );

      let cancelledCount = 0;
      for (const run of runs.workflow_runs) {
        if (run.status === 'in_progress' || run.status === 'queued') {
          await cancelWorkflowRun(options.organization, options.repository, options.githubToken, run.id);
          cancelledCount++;
        }
      }

      return cancelledCount;
    } catch (error) {
      console.error('Error cancelling workflows:', error);
      throw error;
    }
  }

  /**
   * Sets up automation rules for CI/CD pipeline
   */
  async setupAutomationRules(options: CICDOrchestrationOptions): Promise<void> {
    // Default automation rules
    const defaultRules: AutomationRule[] = [
      {
        id: 'auto-run-on-push',
        name: 'Auto-run MegaLinter on push to main branches',
        enabled: true,
        trigger: {
          type: 'push',
          branches: ['main', 'develop', 'master']
        },
        action: {
          type: 'run_workflow',
          parameters: {
            workflow: 'megalinter.yml',
            profile: 'balanced'
          }
        }
      },
      {
        id: 'auto-run-on-pr',
        name: 'Auto-run MegaLinter on pull requests',
        enabled: true,
        trigger: {
          type: 'pull_request',
          branches: ['main', 'develop', 'master']
        },
        action: {
          type: 'run_workflow',
          parameters: {
            workflow: 'megalinter.yml',
            profile: 'fast'
          }
        }
      },
      {
        id: 'weekly-full-scan',
        name: 'Weekly comprehensive scan',
        enabled: options.preferences?.performanceProfile !== 'fast',
        trigger: {
          type: 'schedule',
          schedule: '0 2 * * 1' // Monday at 2 AM
        },
        action: {
          type: 'run_workflow',
          parameters: {
            workflow: 'megalinter.yml',
            profile: 'thorough'
          }
        }
      }
    ];

    // Register automation rules
    for (const rule of defaultRules) {
      this.automationRules.set(rule.id, rule);
    }

    console.log(`✅ Set up ${defaultRules.length} automation rules`);
  }

  /**
   * Triggers automation based on detected events
   */
  async triggerAutomation(
    event: AutomationTrigger,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    const matchingRules = Array.from(this.automationRules.values())
      .filter(rule => rule.enabled && this.matchesTrigger(rule.trigger, event));

    for (const rule of matchingRules) {
      try {
        await this.executeAutomationAction(rule.action, options);
        console.log(`✅ Executed automation rule: ${rule.name}`);
      } catch (error) {
        console.error(`❌ Failed to execute automation rule ${rule.name}:`, error);
      }
    }
  }

  // Private helper methods

  private async analyzeRepositoryForCI(repositoryPath: string): Promise<LanguageProfile> {
    console.log('🔍 Analyzing repository for CI/CD optimization...');
    return await this.repositoryProfiler.analyzeRepository(repositoryPath);
  }

  private async generateOptimalConfig(
    profile: LanguageProfile,
    preferences?: UserPreferences
  ): Promise<MegaLinterConfiguration> {
    console.log('⚙️ Generating optimal MegaLinter configuration...');
    
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
      },
      ...preferences
    };

    return await this.configGenerator.generateConfiguration(profile, defaultPreferences);
  }

  private async selectOptimalWorkflow(
    profile: LanguageProfile,
    preferences?: UserPreferences
  ): Promise<WorkflowTemplate> {
    console.log('📋 Selecting optimal workflow template...');
    
    // Use built-in recommendation logic
    const recommended = this.workflowTemplates.getRecommendedTemplate(profile);
    
    // Apply preference-based overrides
    if (preferences?.securityPreferences?.enableSecurityScanning) {
      return this.workflowTemplates.getTemplate('security') || recommended;
    }
    
    if (preferences?.performanceProfile === 'fast') {
      return this.workflowTemplates.getTemplate('performance') || recommended;
    }
    
    return recommended;
  }

  private async customizeWorkflowForRepository(
    template: WorkflowTemplate,
    profile: LanguageProfile,
    megalinterConfig: MegaLinterConfiguration,
    options: CICDOrchestrationOptions
  ): Promise<string> {
    console.log('🎨 Customizing workflow for repository...');
    
    const generationOptions: WorkflowGenerationOptions = {
      profile,
      preferences: options.preferences,
      megalinterConfig,
      organizationSettings: {
        requiredChecks: ['megalinter'],
        allowedRunners: ['ubuntu-latest'],
        securityScanningRequired: true,
        complianceChecking: false,
        artifactRetentionDays: 30,
        timeoutMinutes: 30
      }
    };

    return await this.workflowGenerator.generateMegaLinterWorkflow(generationOptions);
  }

  private async deployWorkflow(
    owner: string,
    repo: string,
    token: string,
    workflowContent: string,
    commitMessage: string = 'Add/Update MegaLinter workflow'
  ): Promise<WorkflowDeploymentResult> {
    try {
      console.log('🚀 Deploying workflow to repository...');
      
      // Validate workflow before deployment
      const validation = await this.workflowGenerator.validateWorkflow(workflowContent);
      if (!validation.valid) {
        return {
          success: false,
          workflowPath: '.github/workflows/megalinter.yml',
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      await createMegaLinterWorkflow(
        owner,
        repo,
        token,
        workflowContent,
        '.github/workflows/megalinter.yml',
        commitMessage
      );

      return {
        success: true,
        workflowPath: '.github/workflows/megalinter.yml',
        workflowUrl: `https://github.com/${owner}/${repo}/blob/main/.github/workflows/megalinter.yml`,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        workflowPath: '.github/workflows/megalinter.yml',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private async triggerInitialRun(options: CICDOrchestrationOptions): Promise<MegaLinterWorkflowResult> {
    console.log('🎯 Triggering initial workflow run...');
    
    try {
      // Get workflow ID
      const workflows = await listWorkflows(options.organization, options.repository, options.githubToken);
      const megalinterWorkflow = workflows.workflows.find(w => 
        w.name.toLowerCase().includes('megalinter') || w.path.includes('megalinter')
      );

      if (!megalinterWorkflow) {
        throw new Error('MegaLinter workflow not found');
      }

      // Trigger workflow
      const { run_id } = await triggerMegaLinterWorkflow(
        options.organization,
        options.repository,
        options.githubToken,
        megalinterWorkflow.id,
        'main'
      );

      // Wait a moment for the run to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get initial run result
      return await getMegaLinterWorkflowResult(
        options.organization,
        options.repository,
        options.githubToken,
        run_id
      );
    } catch (error) {
      console.error('Failed to trigger initial run:', error);
      throw error;
    }
  }

  private startWorkflowMonitoring(options: CICDOrchestrationOptions, runId: number): void {
    const monitorKey = `${options.organization}/${options.repository}/${runId}`;
    
    if (this.activeMonitors.has(monitorKey)) {
      return; // Already monitoring
    }

    console.log(`👀 Starting workflow monitoring for run ${runId}...`);

    const monitor = setInterval(async () => {
      try {
        const result = await getMegaLinterWorkflowResult(
          options.organization,
          options.repository,
          options.githubToken,
          runId
        );

        if (result.run.status === 'completed') {
          clearInterval(monitor);
          this.activeMonitors.delete(monitorKey);
          
          // Send completion notification
          this.sendWorkflowNotification(result, options);
        }
      } catch (error) {
        console.error('Monitoring error:', error);
        clearInterval(monitor);
        this.activeMonitors.delete(monitorKey);
      }
    }, 30000); // Check every 30 seconds

    this.activeMonitors.set(monitorKey, monitor);
  }

  private async sendWorkflowNotification(
    result: MegaLinterWorkflowResult,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    const status = result.run.conclusion === 'success' ? '✅' : '❌';
    const message = `${status} MegaLinter workflow completed for ${options.organization}/${options.repository}`;
    
    // In a real implementation, this would send notifications via:
    // - VSCode notifications
    // - Slack/Teams/Discord webhooks
    // - Email notifications
    // - Custom notification systems
    
    console.log(message);
    
    // Show VSCode notification
    if (result.run.conclusion === 'success') {
      vscode.window.showInformationMessage(
        `MegaLinter analysis completed successfully! ${result.summary.totalIssues} issues found.`,
        'View Results'
      );
    } else {
      vscode.window.showErrorMessage(
        'MegaLinter workflow failed. Check the workflow logs for details.',
        'View Logs'
      );
    }
  }

  private countConsecutiveFailures(runs: WorkflowRun[]): number {
    let count = 0;
    for (const run of runs) {
      if (run.conclusion === 'failure') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private generateCICDRecommendations(
    recentRuns: WorkflowRun[],
    consecutiveFailures: number,
    hasActiveWorkflows: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (!hasActiveWorkflows) {
      recommendations.push('No active workflows found. Consider setting up MegaLinter workflows.');
    }

    if (consecutiveFailures >= 3) {
      recommendations.push('Multiple consecutive failures detected. Review workflow configuration and repository issues.');
    } else if (consecutiveFailures >= 1) {
      recommendations.push('Recent workflow failures detected. Check logs for specific issues.');
    }

    if (recentRuns.length === 0) {
      recommendations.push('No recent workflow runs found. Consider triggering a test run.');
    }

    const avgDuration = recentRuns.reduce((sum, run) => {
      const duration = new Date(run.updated_at).getTime() - new Date(run.created_at).getTime();
      return sum + duration;
    }, 0) / recentRuns.length;

    if (avgDuration > 30 * 60 * 1000) { // > 30 minutes
      recommendations.push('Workflow execution time is high. Consider optimizing linter configuration or using performance profile.');
    }

    if (recommendations.length === 0) {
      recommendations.push('CI/CD pipeline is healthy and operating normally.');
    }

    return recommendations;
  }

  private matchesTrigger(ruleTrigger: AutomationTrigger, eventTrigger: AutomationTrigger): boolean {
    if (ruleTrigger.type !== eventTrigger.type) {
      return false;
    }

    // Check branch matching
    if (ruleTrigger.branches && eventTrigger.branches) {
      const hasMatchingBranch = ruleTrigger.branches.some(branch =>
        eventTrigger.branches!.includes(branch)
      );
      if (!hasMatchingBranch) {
        return false;
      }
    }

    return true;
  }

  private async executeAutomationAction(
    action: AutomationAction,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    switch (action.type) {
      case 'run_workflow':
        await this.executeWorkflowAction(action.parameters, options);
        break;
      case 'update_config':
        await this.executeConfigUpdateAction(action.parameters, options);
        break;
      case 'create_issue':
        await this.executeCreateIssueAction(action.parameters, options);
        break;
      case 'send_notification':
        await this.executeSendNotificationAction(action.parameters, options);
        break;
      default:
        console.warn(`Unknown automation action type: ${action.type}`);
    }
  }

  private async executeWorkflowAction(
    parameters: Record<string, any>,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    const workflows = await listWorkflows(options.organization, options.repository, options.githubToken);
    const workflow = workflows.workflows.find(w => w.path.includes(parameters.workflow));
    
    if (workflow) {
      await triggerMegaLinterWorkflow(
        options.organization,
        options.repository,
        options.githubToken,
        workflow.id,
        'main',
        { megalinter_profile: parameters.profile }
      );
    }
  }

  private async executeConfigUpdateAction(
    parameters: Record<string, any>,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    // Update MegaLinter configuration based on parameters
    console.log('Updating configuration based on automation rule');
  }

  private async executeCreateIssueAction(
    parameters: Record<string, any>,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    // Create GitHub issue based on parameters
    console.log('Creating issue based on automation rule');
  }

  private async executeSendNotificationAction(
    parameters: Record<string, any>,
    options: CICDOrchestrationOptions
  ): Promise<void> {
    // Send notification based on parameters
    vscode.window.showInformationMessage(parameters.message || 'Automation rule triggered');
  }

  private initializeDefaultAutomation(): void {
    // Initialize with default automation rules
    console.log('🤖 Initializing default automation rules...');
  }

  private async updateAutomationRules(options: CICDOrchestrationOptions): Promise<void> {
    // Update automation rules based on new preferences
    console.log('🔄 Updating automation rules...');
  }

  /**
   * Executes MegaLinter locally and syncs results with GitHub Actions
   */
  async executeHybridLinting(
    options: CICDOrchestrationOptions,
    executeLocally: boolean = true,
    triggerRemote: boolean = true
  ): Promise<{
    localResults?: LintingResults;
    remoteResults?: MegaLinterWorkflowResult;
    comparison?: {
      issuesDiff: number;
      executionTimeDiff: number;
      consistencyScore: number;
    };
  }> {
    const results: any = {};

    try {
      // Execute locally if requested
      if (executeLocally) {
        console.log('🖥️ Executing MegaLinter locally...');
        const profile = await this.analyzeRepositoryForCI(options.repositoryPath);
        const config = await this.generateOptimalConfig(profile, options.preferences);
        
        results.localResults = await this.megalinterOrchestrator.executeLinting(config, options.repositoryPath);
        this.lastLocalResults = results.localResults;
        
        // Emit event for local completion
        this.eventEmitter.fire({
          type: 'status_changed',
          data: { phase: 'local_complete', results: results.localResults }
        });
      }

      // Execute remotely if requested
      if (triggerRemote) {
        console.log('☁️ Triggering remote MegaLinter workflow...');
        const workflows = await listWorkflows(options.organization, options.repository, options.githubToken);
        const megalinterWorkflow = workflows.workflows.find(w =>
          w.name.toLowerCase().includes('megalinter') || w.path.includes('megalinter')
        );

        if (megalinterWorkflow) {
          const { run_id } = await triggerMegaLinterWorkflow(
            options.organization,
            options.repository,
            options.githubToken,
            megalinterWorkflow.id,
            'main'
          );

          // Monitor remote execution
          results.remoteResults = await this.monitorWorkflow(options, run_id);
          this.lastWorkflowResults = results.remoteResults;

          // Emit event for remote completion
          this.eventEmitter.fire({
            type: 'workflow_updated',
            data: { workflowRun: results.remoteResults }
          });
        }
      }

      // Compare results if both are available
      if (results.localResults && results.remoteResults) {
        results.comparison = this.compareResults(results.localResults, results.remoteResults);
      }

      return results;
    } catch (error) {
      console.error('❌ Hybrid execution failed:', error);
      throw error;
    }
  }

  /**
   * Synchronizes local MegaLinter configuration with remote workflow
   */
  async syncConfigurationWithWorkflow(
    options: CICDOrchestrationOptions,
    direction: 'local-to-remote' | 'remote-to-local' | 'bidirectional' = 'local-to-remote'
  ): Promise<{
    success: boolean;
    changes: string[];
    conflicts?: string[];
  }> {
    try {
      console.log(`🔄 Synchronizing configuration (${direction})...`);
      const changes: string[] = [];
      const conflicts: string[] = [];

      if (direction === 'local-to-remote' || direction === 'bidirectional') {
        // Generate local configuration
        const profile = await this.analyzeRepositoryForCI(options.repositoryPath);
        const localConfig = await this.generateOptimalConfig(profile, options.preferences);

        // Update remote workflow with local config
        const workflowTemplate = await this.selectOptimalWorkflow(profile, options.preferences);
        const updatedWorkflow = await this.customizeWorkflowForRepository(
          workflowTemplate,
          profile,
          localConfig,
          options
        );

        const deployment = await this.deployWorkflow(
          options.organization,
          options.repository,
          options.githubToken,
          updatedWorkflow,
          'Sync MegaLinter configuration from local settings'
        );

        if (deployment.success) {
          changes.push('Updated remote workflow with local configuration');
        } else {
          conflicts.push(...(deployment.errors || []));
        }
      }

      if (direction === 'remote-to-local' || direction === 'bidirectional') {
        // This would involve fetching the remote workflow configuration
        // and updating local .mega-linter.yml - implementation depends on workflow format
        changes.push('Remote-to-local sync would require workflow parsing (not implemented)');
      }

      // Emit synchronization event
      this.eventEmitter.fire({
        type: 'configuration_synced',
        data: { direction, changes, conflicts }
      });

      return {
        success: conflicts.length === 0,
        changes,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      };
    } catch (error) {
      console.error('❌ Configuration sync failed:', error);
      return {
        success: false,
        changes: [],
        conflicts: [`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Gets comprehensive integration status
   */
  async getIntegrationStatus(options: CICDOrchestrationOptions): Promise<{
    localStatus: any;
    remoteStatus: CICDStatus;
    syncStatus: 'synced' | 'drift' | 'conflict' | 'unknown';
    lastSync?: Date;
    recommendations: string[];
  }> {
    try {
      // Get local MegaLinter status
      const localStatus = await this.megalinterOrchestrator.getStatus();
      
      // Get remote CI/CD status
      const remoteStatus = await this.getCICDStatus(options);
      
      // Determine sync status
      let syncStatus: 'synced' | 'drift' | 'conflict' | 'unknown' = 'unknown';
      const recommendations: string[] = [];

      if (this.lastLocalResults && this.lastWorkflowResults) {
        const comparison = this.compareResults(this.lastLocalResults, this.lastWorkflowResults);
        if (comparison.consistencyScore > 0.9) {
          syncStatus = 'synced';
        } else if (comparison.consistencyScore > 0.7) {
          syncStatus = 'drift';
          recommendations.push('Consider syncing configurations - some differences detected');
        } else {
          syncStatus = 'conflict';
          recommendations.push('Significant differences detected between local and remote results');
        }
      }

      // Add general recommendations
      if (!localStatus.dockerAvailable) {
        recommendations.push('Docker not available - local MegaLinter execution disabled');
      }

      if (!remoteStatus.hasActiveWorkflows) {
        recommendations.push('No active GitHub Actions workflows - consider setting up CI/CD');
      }

      if (remoteStatus.workflowHealth === 'error') {
        recommendations.push('Remote workflow failures detected - review workflow logs');
      }

      return {
        localStatus,
        remoteStatus,
        syncStatus,
        recommendations
      };
    } catch (error) {
      return {
        localStatus: { dockerAvailable: false, health: 'error' },
        remoteStatus: {
          isRunning: false,
          hasActiveWorkflows: false,
          workflowHealth: 'unknown',
          consecutiveFailures: 0,
          recommendations: ['Unable to retrieve integration status']
        },
        syncStatus: 'unknown',
        recommendations: [`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Provides intelligent recommendations based on repository and workflow analysis
   */
  async getIntelligentRecommendations(options: CICDOrchestrationOptions): Promise<{
    performance: string[];
    configuration: string[];
    workflow: string[];
    integration: string[];
  }> {
    const recommendations = {
      performance: [] as string[],
      configuration: [] as string[],
      workflow: [] as string[],
      integration: [] as string[]
    };

    try {
      const profile = await this.analyzeRepositoryForCI(options.repositoryPath);
      const integrationStatus = await this.getIntegrationStatus(options);

      // Performance recommendations
      if (profile.complexity === 'complex') {
        recommendations.performance.push('Enable incremental scanning for better performance');
        recommendations.performance.push('Consider using matrix strategy for parallel execution');
      }

      if (profile.primary.length > 3) {
        recommendations.performance.push('Multiple languages detected - optimize linter selection');
      }

      // Configuration recommendations
      const hasSecurityFrameworks = profile.frameworks.some(f =>
        ['spring', 'django', 'express'].includes(f)
      );
      if (hasSecurityFrameworks) {
        recommendations.configuration.push('Enable enhanced security scanning for web frameworks');
      }

      if (profile.buildTools.includes('docker')) {
        recommendations.configuration.push('Configure Docker-specific linters');
      }

      // Workflow recommendations
      if (!integrationStatus.remoteStatus.hasActiveWorkflows) {
        recommendations.workflow.push('Set up GitHub Actions workflow for automated linting');
      }

      if (integrationStatus.remoteStatus.consecutiveFailures > 0) {
        recommendations.workflow.push('Review and fix workflow configuration issues');
      }

      // Integration recommendations
      if (integrationStatus.syncStatus === 'drift') {
        recommendations.integration.push('Sync local and remote configurations');
      }

      if (!integrationStatus.localStatus.dockerAvailable) {
        recommendations.integration.push('Install Docker for local MegaLinter execution');
      }

      recommendations.integration.push('Consider hybrid execution for comprehensive analysis');

    } catch (error) {
      recommendations.integration.push('Unable to generate recommendations - check system status');
    }

    return recommendations;
  }

  // Private integration helper methods

  private setupEventIntegration(): void {
    // Listen to MegaLinter orchestrator events
    this.megalinterOrchestrator.onLintingEvent(async (event) => {
      if (event.type === 'completed') {
        this.lastLocalResults = event.data?.results;
        
        // Optionally trigger workflow update based on results
        if (this.shouldTriggerWorkflowUpdate(event.data?.results)) {
          this.eventEmitter.fire({
            type: 'workflow_updated',
            data: { trigger: 'local_completion', results: event.data?.results }
          });
        }
      }
    });
  }

  private shouldTriggerWorkflowUpdate(results?: LintingResults): boolean {
    if (!results) return false;
    
    // Trigger workflow update if significant issues found
    return results.summary.errorCount > 0 || results.summary.totalIssues > 10;
  }

  private compareResults(
    localResults: LintingResults,
    remoteResults: MegaLinterWorkflowResult
  ): {
    issuesDiff: number;
    executionTimeDiff: number;
    consistencyScore: number;
  } {
    const localIssues = localResults.summary.totalIssues;
    const remoteIssues = remoteResults.summary.totalIssues;
    const issuesDiff = Math.abs(localIssues - remoteIssues);
    
    const localTime = localResults.duration;
    const remoteTime = remoteResults.summary.duration;
    const executionTimeDiff = Math.abs(localTime - remoteTime);
    
    // Calculate consistency score based on issue count similarity
    const maxIssues = Math.max(localIssues, remoteIssues);
    const consistencyScore = maxIssues === 0 ? 1.0 : 1.0 - (issuesDiff / maxIssues);
    
    return {
      issuesDiff,
      executionTimeDiff,
      consistencyScore: Math.max(0, consistencyScore)
    };
  }

  /**
   * Cleanup method to clear active monitors and dispose resources
   */
  dispose(): void {
    for (const [key, monitor] of this.activeMonitors) {
      clearInterval(monitor);
    }
    this.activeMonitors.clear();
    
    // Dispose of other resources
    this.megalinterOrchestrator.dispose();
    this.eventEmitter.dispose();
  }
}

// Export default instance
export const cicdOrchestrator = new CICDOrchestrator();