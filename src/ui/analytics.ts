/**
 * Analytics Processor - Processes and transforms MegaLinter and CI/CD data for visualization
 * Generates trend analysis, heat maps, and remediation guidance
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LintingResults,
  LinterResult,
  LinterIssue,
  PerformanceMetrics,
  LanguageProfile,
  EnhancedLanguageProfile,
  LintingSummary
} from '../megalinter/types';
import { MegaLinterWorkflowResult } from '../githubActionsApi';
import {
  DashboardData,
  OverviewMetrics,
  TrendData,
  HeatMapData,
  RemediationItem,
  DailyMetric,
  WeeklyTrend,
  FileHeatMapItem,
  DirectoryHeatMapItem,
  LinterHeatMapItem,
  SeverityDistribution,
  RemediationStep,
  RemediationResource
} from './dashboard';

export interface AnalyticsInput {
  localResults?: LintingResults;
  cicdResults?: any;
  workspacePath: string;
  historicalData?: HistoricalData[];
  profile?: LanguageProfile | EnhancedLanguageProfile;
}

export interface HistoricalData {
  timestamp: Date;
  qualityScore: number;
  totalIssues: number;
  executionTime: number;
  linterResults: LinterResult[];
}

export class AnalyticsProcessor {
  private readonly storageKey = 'megalinter.analytics.history';
  private historicalData: HistoricalData[] = [];

  constructor() {
    this.loadHistoricalData();
  }

  /**
   * Generates comprehensive dashboard data from input sources
   */
  async generateDashboardData(input: AnalyticsInput): Promise<DashboardData> {
    try {
      console.log('🔍 Processing analytics data...');

      // Store current results in history
      if (input.localResults) {
        await this.storeHistoricalData(input.localResults);
      }

      // Generate overview metrics
      const overview = await this.generateOverviewMetrics(input);

      // Generate trend analysis
      const trendAnalysis = await this.generateTrendAnalysis(input);

      // Generate heat map data
      const heatMapData = await this.generateHeatMapData(input);

      // Generate remediation guidance
      const remediationGuidance = await this.generateRemediationGuidance(input);

      // Get performance metrics
      const performanceMetrics = input.localResults?.performance || this.getDefaultPerformanceMetrics();

      // Get configuration
      const configuration = await this.getDefaultConfiguration();

      console.log('✅ Analytics data processed successfully');

      return {
        overview,
        trendAnalysis,
        heatMapData,
        remediationGuidance,
        performanceMetrics,
        configuration
      };
    } catch (error) {
      console.error('❌ Analytics processing failed:', error);
      throw error;
    }
  }

  /**
   * Exports dashboard data in various formats
   */
  async exportData(data: DashboardData, format: 'json' | 'csv' | 'pdf' | 'html'): Promise<string> {
    switch (format) {
      case 'json':
        return this.exportAsJson(data);
      case 'csv':
        return this.exportAsCsv(data);
      case 'html':
        return this.exportAsHtml(data);
      case 'pdf':
        return this.exportAsPdf(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  private async generateOverviewMetrics(input: AnalyticsInput): Promise<OverviewMetrics> {
    const results = input.localResults;
    const cicdResults = input.cicdResults;

    if (!results) {
      return {
        qualityScore: 0,
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        fixableCount: 0,
        trend: 'stable',
        lastUpdated: new Date(),
        cicdStatus: cicdResults?.workflowHealth || 'unknown'
      };
    }

    // Calculate quality score based on issues and file count
    const qualityScore = Math.max(0, Math.min(100, 
      100 - (results.summary.totalIssues / Math.max(results.summary.totalFiles, 1)) * 10
    ));

    // Determine trend from historical data
    const trend = this.calculateTrend();

    return {
      qualityScore: Math.round(qualityScore),
      totalIssues: results.summary.totalIssues,
      errorCount: results.summary.errorCount,
      warningCount: results.summary.warningCount,
      infoCount: results.summary.infoCount,
      fixableCount: results.summary.fixableCount,
      trend,
      lastUpdated: results.timestamp,
      cicdStatus: this.mapCicdStatus(cicdResults)
    };
  }

  private async generateTrendAnalysis(input: AnalyticsInput): Promise<TrendData> {
    const dailyMetrics = this.generateDailyMetrics();
    const weeklyTrends = this.generateWeeklyTrends(dailyMetrics);

    return {
      dailyMetrics,
      weeklyTrends,
      qualityTrend: dailyMetrics.map(m => m.qualityScore),
      issueTypeTrends: {
        errors: this.extractTrendData('errorCount'),
        warnings: this.extractTrendData('warningCount'),
        info: this.extractTrendData('infoCount')
      },
      performanceTrends: {
        executionTime: this.extractTrendData('executionTime'),
        memoryUsage: this.extractTrendData('memoryUsage')
      }
    };
  }

  private async generateHeatMapData(input: AnalyticsInput): Promise<HeatMapData> {
    const results = input.localResults;
    
    if (!results || !results.results) {
      return {
        fileHeatMap: [],
        directoryHeatMap: [],
        linterHeatMap: [],
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
      };
    }

    const fileHeatMap = await this.generateFileHeatMap(results);
    const directoryHeatMap = await this.generateDirectoryHeatMap(fileHeatMap);
    const linterHeatMap = this.generateLinterHeatMap(results.results);
    const severityDistribution = this.generateSeverityDistribution(results);

    return {
      fileHeatMap,
      directoryHeatMap,
      linterHeatMap,
      severityDistribution
    };
  }

  private async generateRemediationGuidance(input: AnalyticsInput): Promise<RemediationItem[]> {
    const results = input.localResults;
    
    if (!results || !results.results) {
      return [];
    }

    const remediationItems: RemediationItem[] = [];
    const issuesByRule = this.groupIssuesByRule(results.results);

    // Sort by frequency and severity
    const sortedRules = Object.entries(issuesByRule)
      .sort(([, a], [, b]) => {
        const severityWeight = (issues: LinterIssue[]) => {
          return issues.reduce((weight, issue) => {
            switch (issue.severity) {
              case 'error': return weight + 3;
              case 'warning': return weight + 2;
              case 'info': return weight + 1;
              default: return weight;
            }
          }, 0);
        };
        return severityWeight(b) - severityWeight(a);
      })
      .slice(0, 10); // Top 10 most impactful rules

    for (const [rule, issues] of sortedRules) {
      const remediation = await this.createRemediationItem(rule, issues);
      remediationItems.push(remediation);
    }

    return remediationItems;
  }

  private generateDailyMetrics(): DailyMetric[] {
    const last30Days = this.historicalData.slice(-30);
    
    if (last30Days.length === 0) {
      return [{
        date: new Date().toISOString().split('T')[0],
        qualityScore: 0,
        totalIssues: 0,
        executionTime: 0,
        lintersRun: 0
      }];
    }

    return last30Days.map(data => ({
      date: data.timestamp.toISOString().split('T')[0],
      qualityScore: data.qualityScore,
      totalIssues: data.totalIssues,
      executionTime: data.executionTime,
      lintersRun: data.linterResults.length
    }));
  }

  private generateWeeklyTrends(dailyMetrics: DailyMetric[]): WeeklyTrend[] {
    const weeks: { [key: string]: DailyMetric[] } = {};
    
    dailyMetrics.forEach(metric => {
      const date = new Date(metric.date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(metric);
    });

    return Object.entries(weeks).map(([week, metrics]) => {
      const averageQuality = metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length;
      const totalScans = metrics.length;
      
      // Calculate improvement rate (simplified)
      const firstQuality = metrics[0]?.qualityScore || 0;
      const lastQuality = metrics[metrics.length - 1]?.qualityScore || 0;
      const improvmentRate = lastQuality - firstQuality;

      return {
        week,
        averageQuality: Math.round(averageQuality),
        totalScans,
        improvmentRate: Math.round(improvmentRate)
      };
    });
  }

  private async generateFileHeatMap(results: LintingResults): Promise<FileHeatMapItem[]> {
    const fileIssues: { [file: string]: LinterIssue[] } = {};
    
    // Group issues by file
    results.results.forEach(linterResult => {
      linterResult.issues.forEach(issue => {
        if (!fileIssues[issue.file]) {
          fileIssues[issue.file] = [];
        }
        fileIssues[issue.file].push(issue);
      });
    });

    return Object.entries(fileIssues).map(([file, issues]) => {
      const issueCount = issues.length;
      const fixableIssues = issues.filter(i => i.fixable).length;
      const linters = [...new Set(issues.map(i => i.linter))];
      
      // Determine severity level
      const hasErrors = issues.some(i => i.severity === 'error');
      const hasWarnings = issues.some(i => i.severity === 'warning');
      
      let severity: 'high' | 'medium' | 'low';
      if (hasErrors || issueCount > 10) {
        severity = 'high';
      } else if (hasWarnings || issueCount > 5) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      return {
        path: file,
        issueCount,
        severity,
        fixableIssues,
        linters,
        lastScanned: results.timestamp
      };
    }).sort((a, b) => b.issueCount - a.issueCount);
  }

  private async generateDirectoryHeatMap(fileHeatMap: FileHeatMapItem[]): Promise<DirectoryHeatMapItem[]> {
    const directories: { [dir: string]: FileHeatMapItem[] } = {};
    
    fileHeatMap.forEach(file => {
      const dir = path.dirname(file.path);
      if (!directories[dir]) {
        directories[dir] = [];
      }
      directories[dir].push(file);
    });

    return Object.entries(directories).map(([dir, files]) => {
      const totalFiles = files.length;
      const totalIssues = files.reduce((sum, f) => sum + f.issueCount, 0);
      const averageQuality = Math.max(0, 100 - (totalIssues / totalFiles) * 10);
      const hotspotFiles = files
        .filter(f => f.severity === 'high')
        .slice(0, 5)
        .map(f => path.basename(f.path));

      return {
        path: dir,
        totalFiles,
        totalIssues,
        averageQuality: Math.round(averageQuality),
        hotspotFiles
      };
    }).sort((a, b) => b.totalIssues - a.totalIssues);
  }

  private generateLinterHeatMap(linterResults: LinterResult[]): LinterHeatMapItem[] {
    return linterResults.map(result => ({
      name: result.linter,
      issuesFound: result.issues.length,
      executionTime: result.duration,
      successRate: result.status === 'success' ? 100 : 0,
      category: this.getLinterCategory(result.linter),
      enabled: true
    })).sort((a, b) => b.issuesFound - a.issuesFound);
  }

  private generateSeverityDistribution(results: LintingResults): SeverityDistribution {
    const distribution = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    
    results.results.forEach(linterResult => {
      linterResult.issues.forEach(issue => {
        switch (issue.severity) {
          case 'error':
            if (this.isCriticalIssue(issue)) {
              distribution.critical++;
            } else {
              distribution.high++;
            }
            break;
          case 'warning':
            distribution.medium++;
            break;
          case 'info':
            distribution.info++;
            break;
          default:
            distribution.low++;
        }
      });
    });

    return distribution;
  }

  private groupIssuesByRule(linterResults: LinterResult[]): { [rule: string]: LinterIssue[] } {
    const grouped: { [rule: string]: LinterIssue[] } = {};
    
    linterResults.forEach(result => {
      result.issues.forEach(issue => {
        const key = `${issue.linter}:${issue.rule}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(issue);
      });
    });

    return grouped;
  }

  private async createRemediationItem(rule: string, issues: LinterIssue[]): Promise<RemediationItem> {
    const [linter, ruleName] = rule.split(':');
    const priority = this.calculatePriority(issues);
    const affectedFiles = [...new Set(issues.map(i => i.file))];
    const estimatedEffort = this.estimateEffort(issues);
    const automationAvailable = this.checkAutomationAvailability(linter, ruleName);

    return {
      id: `remediation-${rule.replace(/[^a-zA-Z0-9]/g, '-')}`,
      priority,
      title: `Fix ${ruleName} issues in ${linter}`,
      description: `${issues.length} instances of ${ruleName} found across ${affectedFiles.length} files`,
      affectedFiles,
      estimatedEffort,
      automationAvailable,
      steps: await this.generateRemediationSteps(linter, ruleName, issues),
      resources: await this.generateRemediationResources(linter, ruleName)
    };
  }

  private async generateRemediationSteps(linter: string, rule: string, issues: LinterIssue[]): Promise<RemediationStep[]> {
    const steps: RemediationStep[] = [];

    // Add analysis step
    steps.push({
      order: 1,
      description: `Analyze ${issues.length} instances of ${rule} in the codebase`,
      automated: false
    });

    // Add automated fix step if available
    if (this.checkAutomationAvailability(linter, rule)) {
      steps.push({
        order: 2,
        description: `Run automated fix for ${rule}`,
        automated: true,
        command: this.getAutomatedFixCommand(linter, rule),
        verification: `Verify that ${rule} issues have been resolved`
      });
    } else {
      steps.push({
        order: 2,
        description: `Manually fix ${rule} issues in affected files`,
        automated: false,
        verification: `Run linter again to verify fixes`
      });
    }

    // Add verification step
    steps.push({
      order: 3,
      description: 'Run complete linting suite to ensure no regressions',
      automated: true,
      command: 'megalinter --fix',
      verification: 'Confirm all tests pass and no new issues introduced'
    });

    return steps;
  }

  private async generateRemediationResources(linter: string, rule: string): Promise<RemediationResource[]> {
    const resources: RemediationResource[] = [];

    // Add linter-specific documentation
    const linterDocs = this.getLinterDocumentation(linter);
    if (linterDocs) {
      resources.push(linterDocs);
    }

    // Add rule-specific resources
    const ruleDoc = this.getRuleDocumentation(linter, rule);
    if (ruleDoc) {
      resources.push(ruleDoc);
    }

    // Add general best practices
    resources.push({
      type: 'reference',
      title: 'Code Quality Best Practices',
      url: 'https://megalinter.io/latest/best-practices/',
      description: 'General guidelines for maintaining code quality'
    });

    return resources;
  }

  // Utility methods

  private calculateTrend(): 'improving' | 'stable' | 'declining' {
    if (this.historicalData.length < 2) {
      return 'stable';
    }

    const recent = this.historicalData.slice(-5);
    const older = this.historicalData.slice(-10, -5);

    if (recent.length === 0 || older.length === 0) {
      return 'stable';
    }

    const recentAvg = recent.reduce((sum, d) => sum + d.qualityScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.qualityScore, 0) / older.length;

    const diff = recentAvg - olderAvg;
    
    if (diff > 2) return 'improving';
    if (diff < -2) return 'declining';
    return 'stable';
  }

  private mapCicdStatus(cicdResults: any): 'success' | 'failure' | 'pending' | 'unknown' {
    if (!cicdResults) return 'unknown';
    
    if (cicdResults.lastRun) {
      switch (cicdResults.lastRun.conclusion) {
        case 'success': return 'success';
        case 'failure': return 'failure';
        default: return cicdResults.isRunning ? 'pending' : 'unknown';
      }
    }
    
    return 'unknown';
  }

  private extractTrendData(metric: string): number[] {
    return this.historicalData.slice(-30).map(data => {
      switch (metric) {
        case 'errorCount':
        case 'warningCount':
        case 'infoCount':
          return data.linterResults.reduce((sum, r) => 
            sum + r.issues.filter(i => i.severity === metric.replace('Count', '')).length, 0);
        case 'executionTime':
          return data.executionTime;
        case 'memoryUsage':
          return 0; // Would need to track this separately
        default:
          return 0;
      }
    });
  }

  private calculatePriority(issues: LinterIssue[]): 'critical' | 'high' | 'medium' | 'low' {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const totalCount = issues.length;

    if (errorCount > 10 || (errorCount > 0 && totalCount > 20)) {
      return 'critical';
    } else if (errorCount > 0 || warningCount > 15) {
      return 'high';
    } else if (warningCount > 5 || totalCount > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private estimateEffort(issues: LinterIssue[]): 'low' | 'medium' | 'high' {
    const fixableCount = issues.filter(i => i.fixable).length;
    const totalCount = issues.length;
    const manualCount = totalCount - fixableCount;

    if (manualCount > 20 || totalCount > 50) {
      return 'high';
    } else if (manualCount > 10 || totalCount > 25) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private checkAutomationAvailability(linter: string, rule: string): boolean {
    // This would be a comprehensive lookup of which rules support auto-fixing
    const autoFixableLinters = ['eslint', 'prettier', 'black', 'gofmt', 'rustfmt'];
    return autoFixableLinters.some(l => linter.toLowerCase().includes(l));
  }

  private getAutomatedFixCommand(linter: string, rule: string): string {
    if (linter.toLowerCase().includes('eslint')) {
      return `npx eslint --fix --rule "${rule}"`;
    } else if (linter.toLowerCase().includes('prettier')) {
      return 'npx prettier --write .';
    } else if (linter.toLowerCase().includes('black')) {
      return 'black .';
    }
    return `${linter} --fix`;
  }

  private getLinterCategory(linter: string): string {
    const categories: { [key: string]: string } = {
      'eslint': 'language',
      'typescript': 'language',
      'prettier': 'format',
      'black': 'format',
      'bandit': 'security',
      'semgrep': 'security',
      'hadolint': 'docker',
      'yamllint': 'config'
    };

    const lowerLinter = linter.toLowerCase();
    for (const [key, category] of Object.entries(categories)) {
      if (lowerLinter.includes(key)) {
        return category;
      }
    }
    return 'other';
  }

  private isCriticalIssue(issue: LinterIssue): boolean {
    const criticalPatterns = [
      'security',
      'vulnerability',
      'injection',
      'xss',
      'csrf',
      'hardcoded',
      'credential'
    ];
    
    const text = `${issue.message} ${issue.rule}`.toLowerCase();
    return criticalPatterns.some(pattern => text.includes(pattern));
  }

  private getLinterDocumentation(linter: string): RemediationResource | null {
    const docs: { [key: string]: RemediationResource } = {
      'eslint': {
        type: 'documentation',
        title: 'ESLint Documentation',
        url: 'https://eslint.org/docs/',
        description: 'Official ESLint documentation and rule reference'
      },
      'prettier': {
        type: 'documentation',
        title: 'Prettier Documentation',
        url: 'https://prettier.io/docs/',
        description: 'Prettier code formatting documentation'
      }
    };

    const lowerLinter = linter.toLowerCase();
    for (const [key, doc] of Object.entries(docs)) {
      if (lowerLinter.includes(key)) {
        return doc;
      }
    }
    return null;
  }

  private getRuleDocumentation(linter: string, rule: string): RemediationResource | null {
    if (linter.toLowerCase().includes('eslint')) {
      return {
        type: 'reference',
        title: `ESLint Rule: ${rule}`,
        url: `https://eslint.org/docs/rules/${rule}`,
        description: `Detailed information about the ${rule} ESLint rule`
      };
    }
    return null;
  }

  private async storeHistoricalData(results: LintingResults): Promise<void> {
    const qualityScore = Math.max(0, Math.min(100, 
      100 - (results.summary.totalIssues / Math.max(results.summary.totalFiles, 1)) * 10
    ));

    const historicalEntry: HistoricalData = {
      timestamp: results.timestamp,
      qualityScore: Math.round(qualityScore),
      totalIssues: results.summary.totalIssues,
      executionTime: results.duration,
      linterResults: results.results
    };

    this.historicalData.push(historicalEntry);
    
    // Keep only last 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.historicalData = this.historicalData.filter(d => d.timestamp > cutoff);
    
    await this.saveHistoricalData();
  }

  private loadHistoricalData(): void {
    try {
      const stored = vscode.workspace.getConfiguration('orgOnboarding').get<string>(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.historicalData = parsed.map((d: any) => ({
          ...d,
          timestamp: new Date(d.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load historical data:', error);
      this.historicalData = [];
    }
  }

  private async saveHistoricalData(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('orgOnboarding');
      await config.update(this.storageKey, JSON.stringify(this.historicalData), vscode.ConfigurationTarget.Global);
    } catch (error) {
      console.warn('Failed to save historical data:', error);
    }
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      totalExecutionTime: 0,
      linterExecutionTimes: {},
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  private async getDefaultConfiguration(): Promise<any> {
    return {
      theme: 'dark',
      refreshInterval: 300000,
      displayMode: 'overview',
      filters: {
        severity: ['error', 'warning', 'info'],
        linters: [],
        fileTypes: [],
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        categories: []
      },
      notifications: {
        qualityThresholdAlerts: true,
        cicdFailureAlerts: true,
        newIssueAlerts: false,
        performanceAlerts: false,
        emailNotifications: false
      },
      exportSettings: {
        formats: ['json', 'html'],
        includeCharts: true,
        includeTrends: true,
        includeRemediation: true
      }
    };
  }

  // Export methods

  private exportAsJson(data: DashboardData): string {
    return JSON.stringify(data, null, 2);
  }

  private exportAsCsv(data: DashboardData): string {
    const rows: string[] = [];
    
    // Header
    rows.push('Type,Name,Value,Date');
    
    // Overview metrics
    rows.push(`Overview,Quality Score,${data.overview.qualityScore},${data.overview.lastUpdated.toISOString()}`);
    rows.push(`Overview,Total Issues,${data.overview.totalIssues},${data.overview.lastUpdated.toISOString()}`);
    rows.push(`Overview,Errors,${data.overview.errorCount},${data.overview.lastUpdated.toISOString()}`);
    rows.push(`Overview,Warnings,${data.overview.warningCount},${data.overview.lastUpdated.toISOString()}`);
    
    // File heat map
    data.heatMapData.fileHeatMap.forEach(file => {
      rows.push(`File,${file.path},${file.issueCount},${file.lastScanned.toISOString()}`);
    });
    
    return rows.join('\n');
  }

  private exportAsHtml(data: DashboardData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>MegaLinter Dashboard Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .error { color: #d73a49; }
        .warning { color: #f66a0a; }
        .success { color: #28a745; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>MegaLinter Dashboard Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Overview</h2>
    <div class="metric">
        <strong>Quality Score:</strong> ${data.overview.qualityScore}%
        <span class="${data.overview.qualityScore >= 80 ? 'success' : data.overview.qualityScore >= 60 ? 'warning' : 'error'}">
            (${data.overview.trend})
        </span>
    </div>
    <div class="metric"><strong>Total Issues:</strong> ${data.overview.totalIssues}</div>
    <div class="metric error"><strong>Errors:</strong> ${data.overview.errorCount}</div>
    <div class="metric warning"><strong>Warnings:</strong> ${data.overview.warningCount}</div>
    
    <h2>File Heat Map</h2>
    <table>
        <tr><th>File</th><th>Issues</th><th>Severity</th><th>Fixable</th></tr>
        ${data.heatMapData.fileHeatMap.slice(0, 20).map(file => 
          `<tr>
            <td>${file.path}</td>
            <td>${file.issueCount}</td>
            <td class="${file.severity}">${file.severity}</td>
            <td>${file.fixableIssues}</td>
          </tr>`
        ).join('')}
    </table>
</body>
</html>`;
  }

  private exportAsPdf(data: DashboardData): string {
    // For now, return HTML that could be converted to PDF
    // In a real implementation, you'd use a library like puppeteer or jsPDF
    return this.exportAsHtml(data);
  }

  dispose(): void {
    // Cleanup if needed
  }
}