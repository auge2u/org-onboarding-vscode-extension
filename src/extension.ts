import * as vscode from "vscode";
import { optIn, validateTrust, checkDrift, syncExtensions, enterpriseSuggest } from "./orgConfigClient";

// Global flags to prevent concurrent operations
let isStatusUpdateInProgress = false;

export function activate(context: vscode.ExtensionContext) {
  console.log('Org Onboarding extension is now active!');

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand("orgOnboarding.optIn", optIn),
    vscode.commands.registerCommand("orgOnboarding.validateTrust", validateTrust),
    vscode.commands.registerCommand("orgOnboarding.checkDrift", checkDrift),
    vscode.commands.registerCommand("orgOnboarding.syncExtensions", syncExtensions),
    vscode.commands.registerCommand("orgOnboarding.enterpriseSuggest", enterpriseSuggest)
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