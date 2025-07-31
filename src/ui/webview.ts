/**
 * Dashboard WebView Provider - Manages VSCode WebView for dashboard display
 * Handles communication between extension and dashboard frontend
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DashboardData, DashboardController } from './dashboard';

export class DashboardWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'megalinter.dashboard';
  
  private view?: vscode.WebviewView;
  private readonly extensionContext: vscode.ExtensionContext;
  private readonly dashboardController: DashboardController;
  private disposed = false;

  constructor(
    context: vscode.ExtensionContext,
    dashboardController: DashboardController
  ) {
    this.extensionContext = context;
    this.dashboardController = dashboardController;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.extensionContext.extensionUri,
        vscode.Uri.file(path.join(this.extensionContext.extensionPath, 'src', 'ui', 'assets'))
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      undefined,
      this.extensionContext.subscriptions
    );

    // Update webview when dashboard data changes
    this.dashboardController.onEvent(event => {
      if (event.type === 'data_updated' && this.view) {
        this.updateWebviewData(event.data);
      }
    });
  }

  public initialize(): void {
    // Register the webview provider
    this.extensionContext.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        DashboardWebViewProvider.viewType,
        this
      )
    );
  }

  public async showDashboard(): Promise<void> {
    if (this.view) {
      this.view.show(true);
    } else {
      // Open the dashboard view
      await vscode.commands.executeCommand('megalinter.dashboard.focus');
    }
  }

  public async updateData(data: DashboardData): Promise<void> {
    await this.updateWebviewData(data);
  }

  private async updateWebviewData(data: DashboardData): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      await this.view.webview.postMessage({
        command: 'updateData',
        data: this.serializeDashboardData(data)
      });
    } catch (error) {
      console.error('Failed to update webview data:', error);
    }
  }

  private async handleWebviewMessage(message: any): Promise<void> {
    try {
      switch (message.command) {
        case 'ready':
          // Webview is ready, send initial data
          const currentData = this.dashboardController.getCurrentData();
          if (currentData) {
            await this.updateWebviewData(currentData);
          }
          break;

        case 'refresh':
          // User requested data refresh
          await this.dashboardController.refreshDashboardData();
          break;

        case 'executeRemediation':
          // User wants to execute a remediation
          if (message.remediationId) {
            await this.dashboardController.executeRemediation(message.remediationId);
          }
          break;

        case 'updateConfiguration':
          // User updated dashboard configuration
          if (message.config) {
            await this.dashboardController.updateConfiguration(message.config);
          }
          break;

        case 'exportData':
          // User wants to export dashboard data
          if (message.format) {
            await this.dashboardController.exportData(message.format);
          }
          break;

        case 'navigateToFile':
          // User clicked on a file in the heat map
          if (message.filepath) {
            await this.navigateToFile(message.filepath, message.line);
          }
          break;

        case 'openExternalLink':
          // User clicked on an external link
          if (message.url) {
            await vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
          break;

        case 'showNotification':
          // Show notification to user
          if (message.type === 'info') {
            vscode.window.showInformationMessage(message.message);
          } else if (message.type === 'warning') {
            vscode.window.showWarningMessage(message.message);
          } else if (message.type === 'error') {
            vscode.window.showErrorMessage(message.message);
          }
          break;

        default:
          console.warn(`Unknown webview message command: ${message.command}`);
      }
    } catch (error) {
      console.error('Error handling webview message:', error);
      vscode.window.showErrorMessage(
        `Dashboard action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get paths to resources
    const assetsPath = path.join(this.extensionContext.extensionPath, 'src', 'ui', 'assets');
    const htmlPath = path.join(assetsPath, 'dashboard.html');
    
    // Try to read HTML template
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');
      
      // Replace placeholders with actual resource URIs
      const cssUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(assetsPath, 'dashboard.css'))
      );
      const jsUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(assetsPath, 'dashboard.js'))
      );
      
      html = html.replace('{{CSS_URI}}', cssUri.toString());
      html = html.replace('{{JS_URI}}', jsUri.toString());
      
      return html;
    }
    
    // Fallback HTML if template doesn't exist yet
    return this.getFallbackHtml(webview);
  }

  private getFallbackHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
        <title>MegaLinter Dashboard</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: 20px;
            }
            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                text-align: center;
            }
            .loading-spinner {
                border: 3px solid var(--vscode-progressBar-background);
                border-top: 3px solid var(--vscode-progressBar-foreground);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .error-container {
                padding: 20px;
                border: 1px solid var(--vscode-errorForeground);
                border-radius: 4px;
                background-color: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-errorForeground);
                margin: 10px 0;
            }
            .button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin: 5px;
            }
            .button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <div id="dashboard-root">
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <h3>Loading MegaLinter Dashboard...</h3>
                <p>Initializing analytics and visualization components...</p>
                <button class="button" onclick="refreshData()">Refresh Data</button>
            </div>
        </div>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Send ready message to extension
            vscode.postMessage({ command: 'ready' });
            
            function refreshData() {
                vscode.postMessage({ command: 'refresh' });
            }
            
            // Listen for messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'updateData':
                        updateDashboard(message.data);
                        break;
                    case 'showError':
                        showError(message.error);
                        break;
                }
            });
            
            function updateDashboard(data) {
                console.log('Received dashboard data:', data);
                
                const root = document.getElementById('dashboard-root');
                if (data && data.overview) {
                    root.innerHTML = createBasicDashboard(data);
                } else {
                    root.innerHTML = '<div class="error-container">No dashboard data available. Click refresh to load data.</div>';
                }
            }
            
            function createBasicDashboard(data) {
                return \`
                    <div class="dashboard-overview">
                        <h2>🎯 MegaLinter Dashboard</h2>
                        
                        <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
                            <div class="metric-card" style="padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-panel-background);">
                                <h3>Quality Score</h3>
                                <div style="font-size: 2em; font-weight: bold; color: \${getQualityColor(data.overview.qualityScore)};">
                                    \${data.overview.qualityScore}%
                                </div>
                                <div style="font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                                    Trend: \${data.overview.trend || 'stable'}
                                </div>
                            </div>
                            
                            <div class="metric-card" style="padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-panel-background);">
                                <h3>Total Issues</h3>
                                <div style="font-size: 2em; font-weight: bold;">
                                    \${data.overview.totalIssues || 0}
                                </div>
                                <div style="font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                                    \${data.overview.fixableCount || 0} fixable
                                </div>
                            </div>
                            
                            <div class="metric-card" style="padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-panel-background);">
                                <h3>CI/CD Status</h3>
                                <div style="font-size: 1.5em; font-weight: bold; color: \${getCicdColor(data.overview.cicdStatus)};">
                                    \${data.overview.cicdStatus || 'unknown'}
                                </div>
                            </div>
                        </div>
                        
                        <div class="issue-breakdown" style="margin: 20px 0;">
                            <h3>Issue Breakdown</h3>
                            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                <div style="color: var(--vscode-errorForeground);">
                                    ❌ Errors: \${data.overview.errorCount || 0}
                                </div>
                                <div style="color: var(--vscode-warningForeground);">
                                    ⚠️  Warnings: \${data.overview.warningCount || 0}
                                </div>
                                <div style="color: var(--vscode-infoForeground);">
                                    ℹ️  Info: \${data.overview.infoCount || 0}
                                </div>
                            </div>
                        </div>
                        
                        <div class="actions" style="margin: 20px 0;">
                            <button class="button" onclick="refreshData()">🔄 Refresh Data</button>
                            <button class="button" onclick="exportData('json')">📁 Export JSON</button>
                            <button class="button" onclick="exportData('html')">📄 Export HTML</button>
                        </div>
                        
                        <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 20px;">
                            Last updated: \${new Date(data.overview.lastUpdated).toLocaleString()}
                        </div>
                    </div>
                \`;
            }
            
            function getQualityColor(score) {
                if (score >= 90) return 'var(--vscode-testing-iconPassed)';
                if (score >= 70) return 'var(--vscode-warningForeground)';
                return 'var(--vscode-errorForeground)';
            }
            
            function getCicdColor(status) {
                switch (status) {
                    case 'success': return 'var(--vscode-testing-iconPassed)';
                    case 'failure': return 'var(--vscode-errorForeground)';
                    case 'pending': return 'var(--vscode-warningForeground)';
                    default: return 'var(--vscode-descriptionForeground)';
                }
            }
            
            function exportData(format) {
                vscode.postMessage({ command: 'exportData', format: format });
            }
            
            function showError(error) {
                const root = document.getElementById('dashboard-root');
                root.innerHTML = \`
                    <div class="error-container">
                        <h3>❌ Dashboard Error</h3>
                        <p>\${error}</p>
                        <button class="button" onclick="refreshData()">Try Again</button>
                    </div>
                \`;
            }
        </script>
    </body>
    </html>`;
  }

  private serializeDashboardData(data: DashboardData): any {
    // Convert dates and other non-serializable data for JSON transfer
    return {
      overview: {
        ...data.overview,
        lastUpdated: data.overview.lastUpdated.toISOString()
      },
      trendAnalysis: {
        ...data.trendAnalysis,
        dailyMetrics: data.trendAnalysis.dailyMetrics.map(metric => ({
          ...metric,
          // date is already a string
        }))
      },
      heatMapData: {
        ...data.heatMapData,
        fileHeatMap: data.heatMapData.fileHeatMap.map(item => ({
          ...item,
          lastScanned: item.lastScanned.toISOString()
        }))
      },
      remediationGuidance: data.remediationGuidance,
      performanceMetrics: data.performanceMetrics,
      configuration: {
        ...data.configuration,
        filters: {
          ...data.configuration.filters,
          dateRange: {
            start: data.configuration.filters.dateRange.start.toISOString(),
            end: data.configuration.filters.dateRange.end.toISOString()
          }
        }
      }
    };
  }

  private async navigateToFile(filepath: string, line?: number): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }

      const fullPath = path.isAbsolute(filepath) 
        ? filepath 
        : path.join(workspaceFolder.uri.fsPath, filepath);
      
      const fileUri = vscode.Uri.file(fullPath);
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document);
      
      if (line && line > 0) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    } catch (error) {
      console.error('Failed to navigate to file:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${filepath}`);
    }
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    this.disposed = true;
    this.view = undefined;
  }
}

/**
 * Full-screen Dashboard Panel Provider for more complex visualizations
 */
export class DashboardPanelProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private readonly extensionContext: vscode.ExtensionContext;
  private readonly dashboardController: DashboardController;

  constructor(
    context: vscode.ExtensionContext,
    dashboardController: DashboardController
  ) {
    this.extensionContext = context;
    this.dashboardController = dashboardController;
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    dashboardController: DashboardController
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (DashboardPanelProvider.currentPanel) {
      DashboardPanelProvider.currentPanel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'megalinterDashboard',
      'MegaLinter Analytics Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          context.extensionUri,
          vscode.Uri.file(path.join(context.extensionPath, 'src', 'ui', 'assets'))
        ]
      }
    );

    DashboardPanelProvider.currentPanel = panel;
    const provider = new DashboardPanelProvider(context, dashboardController);
    provider.setupPanel(panel);
  }

  private setupPanel(panel: vscode.WebviewPanel): void {
    panel.webview.html = this.getHtmlForWebview(panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        // Similar message handling as in DashboardWebViewProvider
        // but adapted for full-screen experience
        switch (message.command) {
          case 'ready':
            const currentData = this.dashboardController.getCurrentData();
            if (currentData) {
              await panel.webview.postMessage({
                command: 'updateData',
                data: currentData
              });
            }
            break;
          // Add other message handlers...
        }
      },
      undefined,
      this.extensionContext.subscriptions
    );

    // Clean up when the panel is closed
    panel.onDidDispose(
      () => {
        DashboardPanelProvider.currentPanel = undefined;
      },
      null,
      this.extensionContext.subscriptions
    );
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Return a more comprehensive HTML for full-screen dashboard
    // This would be similar to DashboardWebViewProvider but optimized for larger screens
    const nonce = this.getNonce();
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MegaLinter Analytics Dashboard</title>
        <style>
            /* Full-screen dashboard styles would go here */
            body { 
                margin: 0; 
                padding: 0; 
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-foreground);
            }
            .dashboard-container {
                display: grid;
                grid-template-columns: 250px 1fr;
                height: 100vh;
            }
            .sidebar {
                background: var(--vscode-sideBar-background);
                border-right: 1px solid var(--vscode-panel-border);
                padding: 20px;
            }
            .main-content {
                padding: 20px;
                overflow-y: auto;
            }
        </style>
    </head>
    <body>
        <div class="dashboard-container">
            <div class="sidebar">
                <h2>🎯 MegaLinter</h2>
                <nav>
                    <button onclick="showView('overview')">Overview</button>
                    <button onclick="showView('trends')">Trends</button>
                    <button onclick="showView('heatmap')">Heat Map</button>
                    <button onclick="showView('remediation')">Remediation</button>
                </nav>
            </div>
            <div class="main-content" id="main-content">
                <div class="loading">Loading dashboard...</div>
            </div>
        </div>
        
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            vscode.postMessage({ command: 'ready' });
            
            function showView(view) {
                // Handle view switching
                console.log('Switching to view:', view);
            }
        </script>
    </body>
    </html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}