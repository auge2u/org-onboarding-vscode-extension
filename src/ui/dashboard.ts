/**
 * Main Dashboard Controller - Coordinates all dashboard functionality
 * Integrates with MegaLinter and GitHub Actions for comprehensive analytics
 */

import * as vscode from 'vscode';
import { MegaLinterOrchestrator } from '../megalinter/orchestrator';
import { CICDOrchestrator } from '../github/cicdOrchestrator';
import { AnalyticsProcessor } from './analytics';
import { DashboardWebViewProvider } from './webview';
import {
  LintingResults,
  MegaLinterConfiguration,
  LanguageProfile,
  PerformanceMetrics
} from '../megalinter/types';
import { MegaLinterWorkflowResult } from '../githubActionsApi';

export interface DashboardData {
  overview: OverviewMetrics;
  trendAnalysis: TrendData;
  heatMapData: HeatMapData;
  remediationGuidance: RemediationItem[];
  performanceMetrics: PerformanceMetrics;
  configuration: DashboardConfiguration;
}

export interface OverviewMetrics {
  qualityScore: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  fixableCount: number;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
  cicdStatus: 'success' | 'failure' | 'pending' | 'unknown';
}

export interface TrendData {
  dailyMetrics: DailyMetric[];
  weeklyTrends: WeeklyTrend[];
  qualityTrend: number[];
  issueTypeTrends: {
    errors: number[];
    warnings: number[];
    info: number[];
  };
  performanceTrends: {
    executionTime: number[];
    memoryUsage: number[];
  };
}

export interface DailyMetric {
  date: string;
  qualityScore: number;
  totalIssues: number;
  executionTime: number;
  lintersRun: number;
}

export interface WeeklyTrend {
  week: string;
  averageQuality: number;
  totalScans: number;
  improvmentRate: number;
}

export interface HeatMapData {
  fileHeatMap: FileHeatMapItem[];
  directoryHeatMap: DirectoryHeatMapItem[];
  linterHeatMap: LinterHeatMapItem[];
  severityDistribution: SeverityDistribution;
}

export interface FileHeatMapItem {
  path: string;
  issueCount: number;
  severity: 'high' | 'medium' | 'low';
  fixableIssues: number;
  linters: string[];
  lastScanned: Date;
}

export interface DirectoryHeatMapItem {
  path: string;
  totalFiles: number;
  totalIssues: number;
  averageQuality: number;
  hotspotFiles: string[];
}

export interface LinterHeatMapItem {
  name: string;
  issuesFound: number;
  executionTime: number;
  successRate: number;
  category: string;
  enabled: boolean;
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface RemediationItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  automationAvailable: boolean;
  steps: RemediationStep[];
  resources: RemediationResource[];
}

export interface RemediationStep {
  order: number;
  description: string;
  automated: boolean;
  command?: string;
  verification?: string;
}

export interface RemediationResource {
  type: 'documentation' | 'example' | 'tool' | 'reference';
  title: string;
  url: string;
  description: string;
}

export interface DashboardConfiguration {
  theme: 'light' | 'dark' | 'high-contrast';
  refreshInterval: number;
  displayMode: 'overview' | 'detailed' | 'trends' | 'heatmap' | 'remediation';
  filters: DashboardFilters;
  notifications: NotificationSettings;
  exportSettings: ExportSettings;
}

export interface DashboardFilters {
  severity: string[];
  linters: string[];
  fileTypes: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  categories: string[];
}

export interface NotificationSettings {
  qualityThresholdAlerts: boolean;
  cicdFailureAlerts: boolean;
  newIssueAlerts: boolean;
  performanceAlerts: boolean;
  emailNotifications: boolean;
}

export interface ExportSettings {
  formats: ('json' | 'csv' | 'pdf' | 'html')[];
  includeCharts: boolean;
  includeTrends: boolean;
  includeRemediation: boolean;
}

export class DashboardController {
  public readonly extensionContext: vscode.ExtensionContext;
  private readonly megalinterOrchestrator: MegaLinterOrchestrator;
  private readonly cicdOrchestrator: CICDOrchestrator;
  private readonly analyticsProcessor: AnalyticsProcessor;
  private readonly webviewProvider: DashboardWebViewProvider;
  
  private currentData: DashboardData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly eventEmitter = new vscode.EventEmitter<{
    type: 'data_updated' | 'config_changed' | 'refresh_requested';
    data: any;
  }>();

  public readonly onEvent = this.eventEmitter.event;

  constructor(
    context: vscode.ExtensionContext,
    megalinterOrchestrator: MegaLinterOrchestrator,
    cicdOrchestrator: CICDOrchestrator
  ) {
    this.extensionContext = context;
    this.megalinterOrchestrator = megalinterOrchestrator;
    this.cicdOrchestrator = cicdOrchestrator;
    this.analyticsProcessor = new AnalyticsProcessor();
    this.webviewProvider = new DashboardWebViewProvider(context, this);

    this.setupEventListeners();
    this.initializeRefreshTimer();
  }

  /**
   * Initializes the dashboard and shows it in VSCode
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing MegaLinter Dashboard...');
      
      // Load initial configuration
      const config = await this.loadConfiguration();
      
      // Generate initial dashboard data
      await this.refreshDashboardData();
      
      // Register webview provider
      this.webviewProvider.initialize();
      
      console.log('✅ Dashboard initialized successfully');
    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);
      vscode.window.showErrorMessage(
        `Failed to initialize dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Shows the dashboard webview
   */
  async showDashboard(): Promise<void> {
    await this.webviewProvider.showDashboard();
    
    // Refresh data when dashboard is shown
    if (!this.currentData) {
      await this.refreshDashboardData();
    }
  }

  /**
   * Refreshes all dashboard data from various sources
   */
  async refreshDashboardData(): Promise<DashboardData> {
    try {
      console.log('🔄 Refreshing dashboard data...');
      
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      // Get latest MegaLinter results
      const megalinterStatus = await this.megalinterOrchestrator.getStatus();
      let localResults: LintingResults | undefined;
      
      if (megalinterStatus.dockerAvailable) {
        try {
          // Try to get recent results or run a quick scan
          const profile = await this.megalinterOrchestrator.detectLanguages(workspaceFolder.uri.fsPath);
          const linters = await this.megalinterOrchestrator.selectLinters(profile, {
            severityThreshold: 'warning',
            performanceProfile: 'fast',
            reportingPreferences: {
              format: 'json' as any,
              includePassingFiles: false,
              detailLevel: 'minimal',
              realTimeUpdates: false
            },
            securityPreferences: {
              enableSecurityScanning: true,
              secretsDetection: true,
              vulnerabilityScanning: false,
              licenseChecking: false
            }
          });
          const config = await this.megalinterOrchestrator.generateConfiguration(profile, linters);
          localResults = await this.megalinterOrchestrator.executeLinting(config, workspaceFolder.uri.fsPath);
        } catch (error) {
          console.warn('Failed to get local MegaLinter results:', error);
        }
      }

      // Get CI/CD status and results
      let cicdResults: any;
      try {
        const githubConfig = vscode.workspace.getConfiguration('orgOnboarding');
        const token = githubConfig.get<string>('github.token');
        const org = githubConfig.get<string>('organization');
        const repo = githubConfig.get<string>('repository');
        
        if (token && org && repo) {
          cicdResults = await this.cicdOrchestrator.getCICDStatus({
            repositoryPath: workspaceFolder.uri.fsPath,
            githubToken: token,
            organization: org,
            repository: repo
          });
        }
      } catch (error) {
        console.warn('Failed to get CI/CD results:', error);
      }

      // Process and generate dashboard data
      this.currentData = await this.analyticsProcessor.generateDashboardData({
        localResults,
        cicdResults,
        workspacePath: workspaceFolder.uri.fsPath
      });

      // Emit data update event
      this.eventEmitter.fire({
        type: 'data_updated',
        data: this.currentData
      });

      // Update webview with new data
      await this.webviewProvider.updateData(this.currentData);

      console.log('✅ Dashboard data refreshed successfully');
      return this.currentData;
    } catch (error) {
      console.error('❌ Failed to refresh dashboard data:', error);
      throw error;
    }
  }

  /**
   * Gets current dashboard data
   */
  getCurrentData(): DashboardData | null {
    return this.currentData;
  }

  /**
   * Updates dashboard configuration
   */
  async updateConfiguration(newConfig: Partial<DashboardConfiguration>): Promise<void> {
    try {
      const currentConfig = await this.loadConfiguration();
      const updatedConfig = { ...currentConfig, ...newConfig };
      
      await this.saveConfiguration(updatedConfig);
      
      // Update refresh timer if interval changed
      if (newConfig.refreshInterval) {
        this.updateRefreshTimer(newConfig.refreshInterval);
      }
      
      // Emit configuration change event
      this.eventEmitter.fire({
        type: 'config_changed',
        data: updatedConfig
      });

      console.log('✅ Dashboard configuration updated');
    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Exports dashboard data in specified format
   */
  async exportData(format: 'json' | 'csv' | 'pdf' | 'html'): Promise<void> {
    if (!this.currentData) {
      throw new Error('No dashboard data available for export');
    }

    try {
      const exportData = await this.analyticsProcessor.exportData(this.currentData, format);
      
      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`megalinter-dashboard.${format}`),
        filters: this.getFileFilters(format)
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(exportData));
        vscode.window.showInformationMessage(`Dashboard data exported to ${saveUri.fsPath}`);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      vscode.window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Handles remediation action execution
   */
  async executeRemediation(remediationId: string): Promise<void> {
    if (!this.currentData) {
      throw new Error('No dashboard data available');
    }

    const remediation = this.currentData.remediationGuidance.find(r => r.id === remediationId);
    if (!remediation) {
      throw new Error(`Remediation item ${remediationId} not found`);
    }

    try {
      console.log(`🔧 Executing remediation: ${remediation.title}`);
      
      for (const step of remediation.steps) {
        if (step.automated && step.command) {
          // Execute automated remediation step
          await this.executeRemediationStep(step);
        } else {
          // Show manual remediation instructions
          const action = await vscode.window.showInformationMessage(
            `Manual step required: ${step.description}`,
            'Mark Complete',
            'Skip',
            'Cancel'
          );
          
          if (action === 'Cancel') {
            return;
          } else if (action === 'Skip') {
            continue;
          }
        }
      }

      vscode.window.showInformationMessage(`✅ Remediation completed: ${remediation.title}`);
      
      // Refresh dashboard data after remediation
      await this.refreshDashboardData();
    } catch (error) {
      console.error('❌ Remediation execution failed:', error);
      vscode.window.showErrorMessage(`Remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen to MegaLinter events
    this.megalinterOrchestrator.onLintingEvent(async (event) => {
      if (event.type === 'completed') {
        await this.refreshDashboardData();
      }
    });

    // Listen to CI/CD events
    this.cicdOrchestrator.onEvent(async (event) => {
      if (event.type === 'workflow_updated' || event.type === 'status_changed') {
        await this.refreshDashboardData();
      }
    });
  }

  private initializeRefreshTimer(): void {
    const config = vscode.workspace.getConfiguration('orgOnboarding');
    const refreshInterval = config.get<number>('dashboard.refreshInterval', 300000); // 5 minutes default
    
    this.updateRefreshTimer(refreshInterval);
  }

  private updateRefreshTimer(intervalMs: number): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshDashboardData();
      } catch (error) {
        console.error('Scheduled refresh failed:', error);
      }
    }, intervalMs);
  }

  private async loadConfiguration(): Promise<DashboardConfiguration> {
    const config = vscode.workspace.getConfiguration('orgOnboarding');
    
    return {
      theme: config.get('dashboard.theme', 'dark') as 'light' | 'dark' | 'high-contrast',
      refreshInterval: config.get('dashboard.refreshInterval', 300000),
      displayMode: config.get('dashboard.displayMode', 'overview') as any,
      filters: {
        severity: config.get('dashboard.filters.severity', ['error', 'warning', 'info']),
        linters: config.get('dashboard.filters.linters', []),
        fileTypes: config.get('dashboard.filters.fileTypes', []),
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        },
        categories: config.get('dashboard.filters.categories', [])
      },
      notifications: {
        qualityThresholdAlerts: config.get('dashboard.notifications.qualityThresholdAlerts', true),
        cicdFailureAlerts: config.get('dashboard.notifications.cicdFailureAlerts', true),
        newIssueAlerts: config.get('dashboard.notifications.newIssueAlerts', false),
        performanceAlerts: config.get('dashboard.notifications.performanceAlerts', false),
        emailNotifications: config.get('dashboard.notifications.emailNotifications', false)
      },
      exportSettings: {
        formats: config.get('dashboard.export.formats', ['json', 'html']),
        includeCharts: config.get('dashboard.export.includeCharts', true),
        includeTrends: config.get('dashboard.export.includeTrends', true),
        includeRemediation: config.get('dashboard.export.includeRemediation', true)
      }
    };
  }

  private async saveConfiguration(config: DashboardConfiguration): Promise<void> {
    const vsconfig = vscode.workspace.getConfiguration('orgOnboarding');
    
    await vsconfig.update('dashboard.theme', config.theme, vscode.ConfigurationTarget.Workspace);
    await vsconfig.update('dashboard.refreshInterval', config.refreshInterval, vscode.ConfigurationTarget.Workspace);
    await vsconfig.update('dashboard.displayMode', config.displayMode, vscode.ConfigurationTarget.Workspace);
    await vsconfig.update('dashboard.filters', config.filters, vscode.ConfigurationTarget.Workspace);
    await vsconfig.update('dashboard.notifications', config.notifications, vscode.ConfigurationTarget.Workspace);
    await vsconfig.update('dashboard.export', config.exportSettings, vscode.ConfigurationTarget.Workspace);
  }

  private getFileFilters(format: string): Record<string, string[]> {
    switch (format) {
      case 'json':
        return { 'JSON Files': ['json'] };
      case 'csv':
        return { 'CSV Files': ['csv'] };
      case 'pdf':
        return { 'PDF Files': ['pdf'] };
      case 'html':
        return { 'HTML Files': ['html'] };
      default:
        return { 'All Files': ['*'] };
    }
  }

  private async executeRemediationStep(step: RemediationStep): Promise<void> {
    if (!step.command) {
      return;
    }

    // Execute the command in VSCode terminal
    const terminal = vscode.window.createTerminal(`MegaLinter Remediation ${step.order}`);
    terminal.sendText(step.command);
    terminal.show();

    // Wait for user confirmation if verification is needed
    if (step.verification) {
      await vscode.window.showInformationMessage(
        `Please verify: ${step.verification}`,
        'Continue'
      );
    }
  }

  /**
   * Cleanup method
   */
  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.eventEmitter.dispose();
    this.webviewProvider.dispose();
  }
}