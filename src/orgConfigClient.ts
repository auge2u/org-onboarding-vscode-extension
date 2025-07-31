import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getLatestWorkflowStatus, getRepoInfo, getStatusIcon } from "./githubActionsApi";
import { parseOsvScanner, parseTrunk, formatSecuritySummary } from "./securityScanParser";
import { autoSyncExtensions, checkExtensionHealth, checkMissingExtensionsSilent, DEFAULT_ORG_EXTENSIONS } from "./autoSyncExtensions";
import { suggestOrgSetup } from "./autoSuggestOrgSetup";
import { suggestEnterpriseFeatures, getEnterpriseStatus } from "./enterpriseValueSuggest";

// Global flags to prevent concurrent operations
let isDriftCheckInProgress = false;
let isTrustValidationInProgress = false;

export interface TrustSignals {
  eslintConfigured: boolean;
  trunkConfigured: boolean; // maintained for backward compatibility
  megalinterConfigured?: boolean; // new MegaLinter field
  megalinterStatus?: 'success' | 'failure' | 'pending' | 'unknown'; // new field
  linterCoverage?: number; // percentage of recommended linters active
  performanceScore?: number; // execution efficiency metric
  extensionsAligned: boolean;
  ciStatus: 'success' | 'failure' | 'pending' | 'unknown';
  securityScanStatus: 'clean' | 'issues' | 'unknown';
  lastUpdated: Date;
}

export interface DriftDetection {
  configDrift: string[];
  extensionDrift: string[];
  lintingDrift: string[]; // maintained for backward compatibility
  megalinterDrift?: string[]; // new: MegaLinter-specific drift
  configurationDrift?: string[]; // enhanced config drift detection
  performanceDrift?: string[]; // new: performance regression detection
  hasAnyDrift: boolean;
}

// Main opt-in function
export async function optIn(): Promise<void> {
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  const isOptedIn = config.get<boolean>('optedIn', false);
  
  if (isOptedIn) {
    vscode.window.showInformationMessage(
      "✅ You're already opted in to organization standards!",
      "View Status",
      "Check Drift"
    ).then((choice: string | undefined) => {
      if (choice === "View Status") {
        validateTrust();
      } else if (choice === "Check Drift") {
        checkDrift();
      }
    });
    return;
  }

  const message = `🏢 **Welcome to Org Standards Onboarding!**

This extension helps you:
• 🔧 Set up consistent dev environment
• 📋 Align with organization standards  
• 🔒 Enable security and quality checks
• 📊 Monitor compliance and drift
• 🚀 Boost team productivity

Your data stays local - we only help sync configurations.

Would you like to opt in to organization standards?`;

  const choice = await vscode.window.showInformationMessage(
    message,
    "Opt In",
    "Learn More",
    "Maybe Later"
  );

  switch (choice) {
    case "Opt In":
      await performOptIn();
      break;
    case "Learn More":
      await showOnboardingInfo();
      break;
    default:
      // Maybe Later
      break;
  }
}

async function performOptIn(): Promise<void> {
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  
  // Set opt-in status
  await config.update('optedIn', true, vscode.ConfigurationTarget.Global);
  await config.update('optInDate', new Date().toISOString(), vscode.ConfigurationTarget.Global);
  
  // Get organization context
  const orgInfo = await detectOrganizationContext();
  if (orgInfo.org) {
    await config.update('organization', orgInfo.org, vscode.ConfigurationTarget.Global);
    await config.update('repository', orgInfo.repo, vscode.ConfigurationTarget.Global);
  }

  vscode.window.showInformationMessage(
    `✅ Successfully opted in to ${orgInfo.org || 'organization'} standards!`,
    "Sync Extensions",
    "Check Standards",
    "View Status"
  ).then((choice: string | undefined) => {
    switch (choice) {
      case "Sync Extensions":
        syncExtensions();
        break;
      case "Check Standards":
        if (orgInfo.org && orgInfo.repo) {
          suggestOrgSetup(orgInfo.repo, orgInfo.org);
        }
        break;
      case "View Status":
        validateTrust();
        break;
    }
  });

  // Auto-suggest organization setup (only if not already prompted recently)
  if (orgInfo.org && orgInfo.repo) {
    const lastPrompted = config.get<string>('lastPrompted');
    const lastPromptedTime = lastPrompted ? new Date(lastPrompted).getTime() : 0;
    const now = new Date().getTime();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Only auto-suggest if we haven't prompted in the last 5 minutes
    if (lastPromptedTime < fiveMinutesAgo) {
      setTimeout(() => {
        suggestOrgSetup(orgInfo.repo!, orgInfo.org!);
        // Update last prompted time to prevent rapid re-prompting
        config.update('lastPrompted', new Date().toISOString(), vscode.ConfigurationTarget.Workspace);
      }, 2000);
    }
  }
}

// Trust validation function
export async function validateTrust(): Promise<void> {
  // Prevent concurrent trust validations
  if (isTrustValidationInProgress) {
    return;
  }
  
  isTrustValidationInProgress = true;
  
  try {
    const signals = await gatherTrustSignals();
  const trustLevel = calculateTrustLevel(signals);
  const message = formatTrustMessage(signals, trustLevel);

  const actions = ["Refresh", "Fix Issues"];
  if (trustLevel >= 70) {
    actions.push("Enterprise Features");
  }

  vscode.window.showInformationMessage(message, ...actions)
    .then((choice: string | undefined) => {
      switch (choice) {
        case "Refresh":
          validateTrust();
          break;
        case "Fix Issues":
          checkDrift();
          break;
        case "Enterprise Features":
          const config = vscode.workspace.getConfiguration('orgOnboarding');
          const org = config.get<string>('organization', 'your organization');
          suggestEnterpriseFeatures(org);
          break;
      }
    });
  } finally {
    isTrustValidationInProgress = false;
  }
}

// Drift detection function
export async function checkDrift(): Promise<void> {
  // Prevent concurrent drift checks to avoid loops
  if (isDriftCheckInProgress) {
    vscode.window.showInformationMessage("⚠️ Drift check already in progress. Please wait for it to complete.");
    return;
  }
  
  isDriftCheckInProgress = true;
  
  try {
    const drift = await detectConfigDrift();
  
  if (!drift.hasAnyDrift) {
    vscode.window.showInformationMessage("✅ No configuration drift detected! Everything is aligned with organization standards.");
    return;
  }

  const driftItems = [
    ...drift.configDrift.map(item => `📄 Config: ${item}`),
    ...drift.extensionDrift.map(item => `🔌 Extension: ${item}`),
    ...drift.lintingDrift.map(item => `🔍 Linting: ${item}`)
  ];

  const message = `⚠️ **Configuration Drift Detected**\n\n${driftItems.join('\n')}\n\nWould you like to fix these issues automatically?`;

  const choice = await vscode.window.showWarningMessage(
    message,
    "Fix All",
    "Select Items",
    "View Details",
    "Skip"
  );

  switch (choice) {
    case "Fix All":
      await fixAllDrift(drift);
      break;
    case "Select Items":
      await selectiveDriftFix(drift);
      break;
    case "View Details":
      await showDriftDetails(drift);
      break;
    default:
      // Skip
      break;
  }
  } finally {
    isDriftCheckInProgress = false;
  }
}

// Extension sync function
export async function syncExtensions(): Promise<void> {
  try {
    const missing = await autoSyncExtensions(DEFAULT_ORG_EXTENSIONS);
    
    if (missing.length === 0) {
      const health = await checkExtensionHealth();
      if (health.issues.length > 0) {
        vscode.window.showWarningMessage(
          `Extensions installed but ${health.issues.length} issues found:\n${health.issues.join('\n')}`,
          "Fix Issues"
        ).then((choice: string | undefined) => {
          if (choice === "Fix Issues") {
            fixExtensionIssues(health.issues);
          }
        });
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to sync extensions: ${error}`);
  }
}

// Enterprise suggestion function
export async function enterpriseSuggest(): Promise<void> {
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  const org = config.get<string>('organization', 'your organization');
  const enterpriseStatus = getEnterpriseStatus();
  
  if (enterpriseStatus.enabled) {
    vscode.window.showInformationMessage(
      `🏢 Enterprise features are enabled for ${org}`,
      "View Dashboard",
      "Manage Features"
    ).then((choice: string | undefined) => {
      if (choice === "View Dashboard") {
        vscode.commands.executeCommand('orgOnboarding.openDashboard');
      } else if (choice === "Manage Features") {
        suggestEnterpriseFeatures(org);
      }
    });
  } else {
    suggestEnterpriseFeatures(org);
  }
}

// Helper functions
async function detectOrganizationContext(): Promise<{org?: string, repo?: string}> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return {};

  try {
    // Try to detect from git remote
    const gitConfigPath = path.join(workspaceFolder.uri.fsPath, '.git', 'config');
    if (fs.existsSync(gitConfigPath)) {
      const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
      const remoteMatch = gitConfig.match(/url = https:\/\/github\.com\/([^\/]+)\/([^\/\s]+)/);
      if (remoteMatch) {
        return {
          org: remoteMatch[1],
          repo: remoteMatch[2].replace('.git', '')
        };
      }
    }
  } catch (error) {
    // Fallback to workspace folder name
    return {
      repo: workspaceFolder.name
    };
  }

  return {};
}

async function gatherTrustSignals(): Promise<TrustSignals> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {
      eslintConfigured: false,
      trunkConfigured: false,
      megalinterConfigured: false,
      megalinterStatus: 'unknown',
      linterCoverage: 0,
      performanceScore: 0,
      extensionsAligned: false,
      ciStatus: 'unknown',
      securityScanStatus: 'unknown',
      lastUpdated: new Date()
    };
  }

  const rootPath = workspaceFolder.uri.fsPath;
  
  // Check configurations
  const eslintConfigured = fs.existsSync(path.join(rootPath, 'eslint.config.js')) ||
                          fs.existsSync(path.join(rootPath, '.eslintrc.js'));
  const trunkConfigured = fs.existsSync(path.join(rootPath, '.trunk', 'trunk.yaml'));
  const megalinterConfigured = fs.existsSync(path.join(rootPath, '.mega-linter.yml')) ||
                               fs.existsSync(path.join(rootPath, '.megalinter.yml'));
  
  // Determine MegaLinter status
  let megalinterStatus: 'success' | 'failure' | 'pending' | 'unknown' = 'unknown';
  let linterCoverage = 0;
  let performanceScore = 0;
  
  if (megalinterConfigured) {
    try {
      // Try to get MegaLinter orchestrator status
      const { MegaLinterOrchestrator } = await import('./megalinter/orchestrator');
      const orchestrator = new MegaLinterOrchestrator();
      const status = await orchestrator.getStatus();
      
      megalinterStatus = status.health === 'healthy' ? 'success' :
                        status.health === 'warning' ? 'pending' : 'failure';
      
      // Calculate linter coverage based on detected languages
      const profile = await orchestrator.detectLanguages(rootPath);
      const totalLanguages = profile.primary.length + profile.secondary.length;
      linterCoverage = totalLanguages > 0 ? Math.min((totalLanguages * 10), 100) : 0; // Rough estimate
      
      // Performance score based on configuration complexity
      performanceScore = profile.complexity === 'simple' ? 90 :
                        profile.complexity === 'moderate' ? 75 : 60;
      
    } catch (error) {
      console.warn('Error getting MegaLinter status:', error);
      megalinterStatus = 'failure';
    }
  }
  
  // Check extension alignment
  const health = await checkExtensionHealth();
  const extensionsAligned = health.issues.length === 0;

  // Try to get CI status (if configured)
  let ciStatus: 'success' | 'failure' | 'pending' | 'unknown' = 'unknown';
  try {
    const config = vscode.workspace.getConfiguration('orgOnboarding');
    const githubToken = config.get<string>('github.token');
    const orgInfo = await detectOrganizationContext();
    
    if (githubToken && orgInfo.org && orgInfo.repo) {
      const workflowStatus = await getLatestWorkflowStatus(orgInfo.org, orgInfo.repo, githubToken);
      if (workflowStatus) {
        ciStatus = workflowStatus.conclusion as any || 'pending';
      }
    }
  } catch (error) {
    // CI status remains unknown
  }

  return {
    eslintConfigured,
    trunkConfigured,
    megalinterConfigured,
    megalinterStatus,
    linterCoverage,
    performanceScore,
    extensionsAligned,
    ciStatus,
    securityScanStatus: 'unknown', // Would need actual security scan
    lastUpdated: new Date()
  };
}

function calculateTrustLevel(signals: TrustSignals): number {
  let score = 0;
  if (signals.eslintConfigured) score += 15;
  
  // Prefer MegaLinter over Trunk (higher score for MegaLinter)
  if (signals.megalinterConfigured) {
    score += 35; // Higher score for MegaLinter
    if (signals.megalinterStatus === 'success') score += 10;
    if (signals.linterCoverage && signals.linterCoverage > 70) score += 5;
    if (signals.performanceScore && signals.performanceScore > 80) score += 5;
  } else if (signals.trunkConfigured) {
    score += 20; // Lower score for Trunk (legacy)
  }
  
  if (signals.extensionsAligned) score += 10;
  if (signals.ciStatus === 'success') score += 20;
  if (signals.securityScanStatus === 'clean') score += 15;
  
  return Math.min(score, 100); // Cap at 100%
}

function formatTrustMessage(signals: TrustSignals, trustLevel: number): string {
  const eslintIcon = signals.eslintConfigured ? '✅' : '❌';
  const extIcon = signals.extensionsAligned ? '✅' : '❌';
  const ciIcon = getStatusIcon(signals.ciStatus, signals.ciStatus);
  
  // Show MegaLinter or Trunk status
  let linterIcon = '❌';
  let linterText = 'No Linter Configuration';
  
  if (signals.megalinterConfigured) {
    linterIcon = signals.megalinterStatus === 'success' ? '✅' :
                 signals.megalinterStatus === 'pending' ? '⏳' : '❌';
    const coverage = signals.linterCoverage ? ` (${signals.linterCoverage}% coverage)` : '';
    const performance = signals.performanceScore ? ` - ${signals.performanceScore}% performance` : '';
    linterText = `MegaLinter Setup${coverage}${performance}`;
  } else if (signals.trunkConfigured) {
    linterIcon = '🟡'; // Yellow for legacy Trunk
    linterText = 'Trunk Linting (Legacy - Consider MegaLinter upgrade)';
  }
  
  let trustEmoji = '🔴';
  if (trustLevel >= 85) trustEmoji = '🟢';
  else if (trustLevel >= 70) trustEmoji = '🟡';
  else if (trustLevel >= 50) trustEmoji = '🟠';

  let additionalInfo = '';
  if (signals.megalinterConfigured && signals.linterCoverage) {
    additionalInfo = `\n🔍 Linter Coverage: ${signals.linterCoverage}%`;
  }
  if (signals.performanceScore) {
    additionalInfo += `\n⚡ Performance Score: ${signals.performanceScore}%`;
  }

  return `${trustEmoji} **Trust Level: ${trustLevel}%**

${eslintIcon} ESLint Configuration
${linterIcon} ${linterText}
${extIcon} VSCode Extensions Aligned
${ciIcon} CI/CD Pipeline Status
🔒 Security Scan: ${signals.securityScanStatus}${additionalInfo}

Last updated: ${signals.lastUpdated.toLocaleTimeString()}`;
}

async function detectConfigDrift(): Promise<DriftDetection> {
  const configDrift: string[] = [];
  const extensionDrift: string[] = [];
  const lintingDrift: string[] = [];
  const megalinterDrift: string[] = [];
  const configurationDrift: string[] = [];
  const performanceDrift: string[] = [];

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {
      configDrift,
      extensionDrift,
      lintingDrift,
      megalinterDrift,
      configurationDrift,
      performanceDrift,
      hasAnyDrift: false
    };
  }

  const rootPath = workspaceFolder.uri.fsPath;
  
  // Check for MegaLinter vs Trunk configuration
  const hasMegaLinter = fs.existsSync(path.join(rootPath, '.mega-linter.yml')) ||
                        fs.existsSync(path.join(rootPath, '.megalinter.yml'));
  const hasTrunk = fs.existsSync(path.join(rootPath, '.trunk', 'trunk.yaml'));
  
  if (!hasMegaLinter && !hasTrunk) {
    configDrift.push('Missing linter configuration (recommend MegaLinter setup)');
    megalinterDrift.push('No MegaLinter configuration found');
  } else if (hasTrunk && !hasMegaLinter) {
    megalinterDrift.push('Trunk detected - consider upgrading to MegaLinter for enhanced capabilities');
    configurationDrift.push('Legacy Trunk configuration can be upgraded to MegaLinter');
  }
  
  // Check MegaLinter-specific drift
  if (hasMegaLinter) {
    try {
      const { MegaLinterOrchestrator } = await import('./megalinter/orchestrator');
      const orchestrator = new MegaLinterOrchestrator();
      
      // Check if MegaLinter configuration is outdated
      const profile = await orchestrator.detectLanguages(rootPath);
      const config = await orchestrator.generateConfiguration(profile, []);
      const validation = await orchestrator.validateConfiguration(config);
      
      if (!validation.valid) {
        megalinterDrift.push(...validation.errors.map(e => `MegaLinter config error: ${e.message}`));
      }
      
      if (validation.warnings.length > 0) {
        megalinterDrift.push(...validation.warnings.map(w => `MegaLinter warning: ${w.message}`));
      }
      
      // Check for performance drift
      if (profile.complexity === 'complex' && config.performance.parallelism < 4) {
        performanceDrift.push('MegaLinter parallelism could be increased for better performance');
      }
      
      if (config.performance.cacheStrategy === 'disabled') {
        performanceDrift.push('MegaLinter caching is disabled - enable for better performance');
      }
      
    } catch (error) {
      megalinterDrift.push('Error validating MegaLinter configuration');
    }
  }
  
  // Legacy linting drift check
  if (!fs.existsSync(path.join(rootPath, 'eslint.config.js')) &&
      !fs.existsSync(path.join(rootPath, '.eslintrc.js'))) {
    lintingDrift.push('Missing ESLint configuration');
  }

  // Check extension drift silently (no UI prompts)
  const missing = checkMissingExtensionsSilent();
  extensionDrift.push(...missing.map(id => `Missing extension: ${id}`));

  const hasAnyDrift = configDrift.length > 0 ||
                      extensionDrift.length > 0 ||
                      lintingDrift.length > 0 ||
                      megalinterDrift.length > 0 ||
                      configurationDrift.length > 0 ||
                      performanceDrift.length > 0;
  
  return {
    configDrift,
    extensionDrift,
    lintingDrift,
    megalinterDrift,
    configurationDrift,
    performanceDrift,
    hasAnyDrift
  };
}

async function fixAllDrift(drift: DriftDetection): Promise<void> {
  // Auto-fix what we can
  const orgInfo = await detectOrganizationContext();
  if (orgInfo.org && orgInfo.repo) {
    await suggestOrgSetup(orgInfo.repo, orgInfo.org);
  }
  
  // Sync extensions
  await syncExtensions();
  
  vscode.window.showInformationMessage("✅ Drift fixes applied! Some changes may require a reload.");
}

async function selectiveDriftFix(drift: DriftDetection): Promise<void> {
  const allItems = [
    ...drift.configDrift.map(item => ({ label: item, type: 'config' })),
    ...drift.extensionDrift.map(item => ({ label: item, type: 'extension' })),
    ...drift.lintingDrift.map(item => ({ label: item, type: 'linting' }))
  ];

  const selected = await vscode.window.showQuickPick(allItems, {
    canPickMany: true,
    placeHolder: "Select drift issues to fix"
  });

  if (selected && selected.length > 0) {
    // Apply selected fixes
    const hasConfigFixes = selected.some((item: any) => item.type === 'config');
    const hasExtensionFixes = selected.some((item: any) => item.type === 'extension');

    if (hasConfigFixes) {
      const orgInfo = await detectOrganizationContext();
      if (orgInfo.org && orgInfo.repo) {
        await suggestOrgSetup(orgInfo.repo, orgInfo.org);
      }
    }

    if (hasExtensionFixes) {
      await syncExtensions();
    }

    vscode.window.showInformationMessage(`✅ Applied fixes for ${selected.length} items!`);
  }
}

async function showDriftDetails(drift: DriftDetection): Promise<void> {
  const sections: string[] = [];
  
  if (drift.configDrift.length > 0) {
    sections.push(`**Config Issues (${drift.configDrift.length}):**\n${drift.configDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  if (drift.megalinterDrift && drift.megalinterDrift.length > 0) {
    sections.push(`**MegaLinter Issues (${drift.megalinterDrift.length}):**\n${drift.megalinterDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  if (drift.configurationDrift && drift.configurationDrift.length > 0) {
    sections.push(`**Configuration Drift (${drift.configurationDrift.length}):**\n${drift.configurationDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  if (drift.performanceDrift && drift.performanceDrift.length > 0) {
    sections.push(`**Performance Issues (${drift.performanceDrift.length}):**\n${drift.performanceDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  if (drift.extensionDrift.length > 0) {
    sections.push(`**Extension Issues (${drift.extensionDrift.length}):**\n${drift.extensionDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  if (drift.lintingDrift.length > 0) {
    sections.push(`**Legacy Linting Issues (${drift.lintingDrift.length}):**\n${drift.lintingDrift.map(item => `• ${item}`).join('\n')}`);
  }
  
  const details = `**Configuration Drift Details**

${sections.join('\n\n')}

${sections.length === 0 ? 'No drift detected - your setup is aligned with organization standards!' : 'These issues indicate your local setup has drifted from organization standards. Regular fixes help maintain consistency, security, and performance.'}`;

  const actions = sections.length > 0 ? ["Fix Now", "Ignore"] : ["OK"];
  vscode.window.showInformationMessage(details, ...actions);
}

async function showOnboardingInfo(): Promise<void> {
  const infoMessage = `**Organization Standards Onboarding**

This extension helps maintain consistent development environments across your organization by:

**🔧 Development Setup**
• Syncing VSCode extensions and settings
• Configuring linters (ESLint, Prettier, Trunk)
• Setting up git hooks and CI/CD integration

**📊 Monitoring & Compliance**
• Tracking configuration drift
• Monitoring security vulnerabilities  
• Validating code quality standards

**🚀 Productivity Features**
• Automated issue remediation
• Enterprise integrations
• Centralized reporting and analytics

**🔒 Privacy & Security**
• All processing happens locally
• No code or data sent to external servers
• Optional telemetry for improvement (opt-in only)

Ready to get started?`;

  const choice = await vscode.window.showInformationMessage(
    infoMessage,
    "Opt In Now",
    "Maybe Later"
  );

  if (choice === "Opt In Now") {
    await performOptIn();
  }
}

async function fixExtensionIssues(issues: string[]): Promise<void> {
  vscode.window.showInformationMessage(
    `Attempting to fix ${issues.length} extension issues...`,
    "View Details"
  ).then((choice: string | undefined) => {
    if (choice === "View Details") {
      vscode.window.showInformationMessage(issues.join('\n'));
    }
  });
}