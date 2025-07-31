import * as vscode from "vscode";
import { optIn, validateTrust, checkDrift, syncExtensions, enterpriseSuggest } from "./orgConfigClient";
import { DashboardController } from "./ui/dashboard";
import { DashboardWebViewProvider, DashboardPanelProvider } from "./ui/webview";
import { MegaLinterOrchestrator } from "./megalinter/orchestrator";
import { CICDOrchestrator } from "./github/cicdOrchestrator";

// Global flags to prevent concurrent operations
let isStatusUpdateInProgress = false;

// Global dashboard components
let dashboardController: DashboardController;
let dashboardWebViewProvider: DashboardWebViewProvider;
let megalinterOrchestrator: MegaLinterOrchestrator;
let cicdOrchestrator: CICDOrchestrator;

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Org Onboarding extension with MegaLinter Dashboard is now active!');

  // Initialize MegaLinter and CI/CD orchestrators
  megalinterOrchestrator = new MegaLinterOrchestrator();
  cicdOrchestrator = new CICDOrchestrator();

  // Initialize dashboard components
  dashboardController = new DashboardController(context, megalinterOrchestrator, cicdOrchestrator);
  dashboardWebViewProvider = new DashboardWebViewProvider(context, dashboardController);

  // Register all existing commands
  context.subscriptions.push(
    vscode.commands.registerCommand("orgOnboarding.optIn", optIn),
    vscode.commands.registerCommand("orgOnboarding.validateTrust", validateTrust),
    vscode.commands.registerCommand("orgOnboarding.checkDrift", checkDrift),
    vscode.commands.registerCommand("orgOnboarding.syncExtensions", syncExtensions),
    vscode.commands.registerCommand("orgOnboarding.enterpriseSuggest", enterpriseSuggest),
    
    // Dashboard commands
    vscode.commands.registerCommand("orgOnboarding.showDashboard", showDashboard),
    vscode.commands.registerCommand("orgOnboarding.showDashboardPanel", showDashboardPanel),
    vscode.commands.registerCommand("orgOnboarding.refreshDashboard", refreshDashboard),
    vscode.commands.registerCommand("orgOnboarding.runMegaLinter", runMegaLinter),
    vscode.commands.registerCommand("orgOnboarding.setupCI", setupCI),
    vscode.commands.registerCommand("orgOnboarding.exportDashboard", exportDashboard)
  );

  // Auto-trigger onboarding for new workspaces
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  const isOptedIn = config.get<boolean>('optedIn', false);
  
  if (!isOptedIn && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Show onboarding prompt after a short delay
    setTimeout(() => {
      showInitialOnboardingPrompt();
    }, 3000);
  }

  // Set up status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'orgOnboarding.validateTrust';
  statusBarItem.text = '$(shield) Org Standards';
  statusBarItem.tooltip = 'Check organization standards compliance';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar based on compliance
  updateStatusBar(statusBarItem);
  
  // Set up periodic compliance checks
  const intervalId = setInterval(() => {
    updateStatusBar(statusBarItem);
  }, 300000); // Check every 5 minutes

  context.subscriptions.push({
    dispose: () => clearInterval(intervalId)
  });
}

export function deactivate() {
  console.log('Org Onboarding extension is deactivated');
}

async function showInitialOnboardingPrompt(): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    "🏢 Welcome! Would you like to set up organization standards for this workspace?",
    "Get Started",
    "Learn More",
    "Not Now"
  );

  switch (choice) {
    case "Get Started":
      vscode.commands.executeCommand('orgOnboarding.optIn');
      break;
    case "Learn More":
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-org/org-onboarding-vscode-extension#readme'));
      break;
    default:
      // Not Now - maybe ask again later
      const config = vscode.workspace.getConfiguration('orgOnboarding');
      await config.update('lastPrompted', new Date().toISOString(), vscode.ConfigurationTarget.Workspace);
      break;
  }
}

async function updateStatusBar(statusBarItem: vscode.StatusBarItem): Promise<void> {
  // Prevent overlapping status updates to avoid loops
  if (isStatusUpdateInProgress) {
    return;
  }
  
  isStatusUpdateInProgress = true;
  
  try {
    const config = vscode.workspace.getConfiguration('orgOnboarding');
    const isOptedIn = config.get<boolean>('optedIn', false);

    if (!isOptedIn) {
      statusBarItem.text = '$(alert) Org Standards';
      statusBarItem.tooltip = 'Click to opt in to organization standards';
      statusBarItem.command = 'orgOnboarding.optIn';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    // Quick compliance check
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      // Simple check for key files
      const hasConfig = await vscode.workspace.findFiles('.trunk/trunk.yaml', null, 1);
      const hasEslint = await vscode.workspace.findFiles('eslint.config.js', null, 1);
      
      if (hasConfig.length > 0 && hasEslint.length > 0) {
        statusBarItem.text = '$(shield-check) Org Standards';
        statusBarItem.tooltip = 'Organization standards: Compliant';
        statusBarItem.backgroundColor = undefined;
      } else {
        statusBarItem.text = '$(shield-x) Org Standards';
        statusBarItem.tooltip = 'Organization standards: Issues detected';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }
    } catch (error) {
      statusBarItem.text = '$(shield) Org Standards';
      statusBarItem.tooltip = 'Organization standards: Status unknown';
      statusBarItem.backgroundColor = undefined;
    }
    
    statusBarItem.command = 'orgOnboarding.validateTrust';
  } finally {
    isStatusUpdateInProgress = false;
  }
  }
  
  // Dashboard command implementations
  async function showDashboard(): Promise<void> {
    try {
      await dashboardWebViewProvider.showDashboard();
      vscode.window.showInformationMessage('📊 Dashboard opened in sidebar');
    } catch (error) {
      console.error('Error showing dashboard:', error);
      vscode.window.showErrorMessage('Failed to open dashboard');
    }
  }
  
  async function showDashboardPanel(): Promise<void> {
    try {
      DashboardPanelProvider.createOrShow(dashboardController.extensionContext, dashboardController);
      vscode.window.showInformationMessage('📊 Dashboard panel opened');
    } catch (error) {
      console.error('Error showing dashboard panel:', error);
      vscode.window.showErrorMessage('Failed to open dashboard panel');
    }
  }
  
  async function refreshDashboard(): Promise<void> {
    try {
      await dashboardController.refreshDashboardData();
      vscode.window.showInformationMessage('🔄 Dashboard data refreshed');
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      vscode.window.showErrorMessage('Failed to refresh dashboard');
    }
  }
  
  async function runMegaLinter(): Promise<void> {
    try {
      vscode.window.showInformationMessage('🔍 Running MegaLinter analysis...');
      
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }
  
      // Detect languages and generate configuration
      const profile = await megalinterOrchestrator.detectLanguages(workspaceFolder.uri.fsPath);
      const linters = await megalinterOrchestrator.selectLinters(profile, {
        severityThreshold: 'warning',
        performanceProfile: 'fast',
        reportingPreferences: {
          format: 'json' as any,
          includePassingFiles: false,
          detailLevel: 'standard',
          realTimeUpdates: false
        },
        securityPreferences: {
          enableSecurityScanning: true,
          secretsDetection: true,
          vulnerabilityScanning: false,
          licenseChecking: false
        }
      });
      const config = await megalinterOrchestrator.generateConfiguration(profile, linters);
      
      const result = await megalinterOrchestrator.executeLinting(config, workspaceFolder.uri.fsPath);
      
      if (result.summary.totalIssues === 0) {
        vscode.window.showInformationMessage(`✅ MegaLinter completed successfully - No issues found`);
      } else {
        vscode.window.showWarningMessage(`⚠️ MegaLinter found ${result.summary.totalIssues} issues`);
      }
      
      // Refresh dashboard to show updated data
      await dashboardController.refreshDashboardData();
    } catch (error) {
      console.error('Error running MegaLinter:', error);
      vscode.window.showErrorMessage(`Failed to run MegaLinter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async function setupCI(): Promise<void> {
    try {
      vscode.window.showInformationMessage('⚙️ Setting up CI/CD pipeline...');
      
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }
  
      const githubConfig = vscode.workspace.getConfiguration('orgOnboarding');
      const token = githubConfig.get<string>('github.token');
      const org = githubConfig.get<string>('organization');
      const repo = githubConfig.get<string>('repository');
      
      if (!token || !org || !repo) {
        vscode.window.showErrorMessage('GitHub configuration missing. Please configure GitHub token, organization, and repository.');
        return;
      }
  
      // Setup CI/CD orchestration
      const result = await cicdOrchestrator.orchestrateCI({
        repositoryPath: workspaceFolder.uri.fsPath,
        githubToken: token,
        organization: org,
        repository: repo,
        autoTrigger: false,
        monitorProgress: true
      });
      
      if (result.deployment.success) {
        vscode.window.showInformationMessage('✅ CI/CD pipeline setup completed');
        // Refresh dashboard to show updated data
        await dashboardController.refreshDashboardData();
      } else {
        vscode.window.showWarningMessage('⚠️ CI/CD pipeline setup completed with warnings');
      }
    } catch (error) {
      console.error('Error setting up CI:', error);
      vscode.window.showErrorMessage(`Failed to setup CI/CD pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async function exportDashboard(): Promise<void> {
    try {
      const format = await vscode.window.showQuickPick(
        ['JSON', 'CSV', 'HTML', 'PDF'],
        { placeHolder: 'Select export format' }
      );
      
      if (!format) return;
      
      await dashboardController.exportData(format.toLowerCase() as 'json' | 'csv' | 'html' | 'pdf');
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      vscode.window.showErrorMessage('Failed to export dashboard');
    }
  }