import * as vscode from "vscode";

export interface EnterpriseFeature {
  id: string;
  name: string;
  description: string;
  value: string;
  category: 'compliance' | 'security' | 'productivity' | 'governance';
}

export const ENTERPRISE_FEATURES: EnterpriseFeature[] = [
  {
    id: 'centralized-audit-logs',
    name: 'Centralized Audit Logs',
    description: 'Track all code quality, security, and compliance activities across repositories',
    value: 'Compliance reporting, security auditing, developer activity insights',
    category: 'compliance'
  },
  {
    id: 'standards-enforcement',
    name: 'Standards Enforcement',
    description: 'Automatically enforce organization coding standards and policies',
    value: 'Reduced technical debt, consistent code quality, faster reviews',
    category: 'governance'
  },
  {
    id: 'drift-monitoring',
    name: 'CI/CD Drift Monitoring',
    description: 'Monitor and alert when repositories drift from organization standards',
    value: 'Proactive compliance, reduced security risks, consistency',
    category: 'governance'
  },
  {
    id: 'security-dashboard',
    name: 'Security Dashboard',
    description: 'Unified view of security vulnerabilities across all repositories',
    value: 'Risk visibility, faster remediation, compliance reporting',
    category: 'security'
  },
  {
    id: 'developer-metrics',
    name: 'Developer Productivity Metrics',
    description: 'Track code quality improvements and developer efficiency',
    value: 'Performance insights, team optimization, ROI measurement',
    category: 'productivity'
  },
  {
    id: 'automated-remediation',
    name: 'Automated Issue Remediation',
    description: 'Automatically fix common security and quality issues',
    value: 'Reduced manual work, faster fixes, consistent results',
    category: 'productivity'
  },
  {
    id: 'policy-as-code',
    name: 'Policy as Code',
    description: 'Define and enforce organizational policies through code',
    value: 'Scalable governance, version-controlled policies, automation',
    category: 'governance'
  },
  {
    id: 'integration-apis',
    name: 'Enterprise Integration APIs',
    description: 'Integrate with existing enterprise tools (JIRA, ServiceNow, etc.)',
    value: 'Workflow automation, unified toolchain, reduced context switching',
    category: 'productivity'
  }
];

export function suggestEnterpriseFeatures(org: string): void {
  const message = `🏢 **Enterprise Features for ${org}**

Unlock advanced capabilities for your organization:

**🔒 Security & Compliance**
• Centralized audit logs for compliance reporting
• Security dashboard with vulnerability tracking
• Automated policy enforcement

**📊 Productivity & Insights**  
• Developer productivity metrics and analytics
• Automated issue remediation
• CI/CD drift monitoring and alerts

**🔧 Integration & Governance**
• Enterprise API integrations (JIRA, ServiceNow)
• Policy as code for scalable governance
• Standards enforcement across all repositories

Would you like to enable these enterprise features?`;

  vscode.window.showInformationMessage(
    message,
    "Learn More",
    "Enable Features",
    "Contact Sales",
    "Maybe Later"
  ).then((choice: string | undefined) => {
    switch (choice) {
      case "Learn More":
        showEnterpriseDetails();
        break;
      case "Enable Features":
        enableEnterpriseFeatures(org);
        break;
      case "Contact Sales":
        contactSales(org);
        break;
      default:
        // Maybe Later - do nothing
        break;
    }
  });
}

async function showEnterpriseDetails(): Promise<void> {
  const categories = [...new Set(ENTERPRISE_FEATURES.map(f => f.category))];
  
  const selectedCategory = await vscode.window.showQuickPick(categories, {
    placeHolder: "Select a category to learn more"
  });

  if (!selectedCategory) return;

  const categoryFeatures = ENTERPRISE_FEATURES.filter(f => f.category === selectedCategory);
  const featureItems = categoryFeatures.map(feature => ({
    label: feature.name,
    description: feature.description,
    detail: `Value: ${feature.value}`,
    feature
  }));

  const selectedFeature = await vscode.window.showQuickPick(featureItems, {
    placeHolder: `Select a ${selectedCategory} feature to learn more`
  });

  if (selectedFeature) {
    showFeatureDetail(selectedFeature.feature);
  }
}

function showFeatureDetail(feature: EnterpriseFeature): void {
  const detailMessage = `**${feature.name}**

${feature.description}

**Business Value:**
${feature.value}

**Category:** ${feature.category}

This feature helps enterprises maintain consistent standards, improve security posture, and increase developer productivity across all repositories.

Would you like to enable this feature or learn about the full enterprise package?`;

  vscode.window.showInformationMessage(
    detailMessage,
    "Enable This Feature",
    "View All Features",
    "Contact Sales"
  ).then((choice: string | undefined) => {
    switch (choice) {
      case "Enable This Feature":
        enableSpecificFeature(feature);
        break;
      case "View All Features":
        showEnterpriseDetails();
        break;
      case "Contact Sales":
        contactSales();
        break;
    }
  });
}

async function enableEnterpriseFeatures(org: string): Promise<void> {
  const featureItems = ENTERPRISE_FEATURES.map(feature => ({
    label: feature.name,
    description: feature.description,
    detail: feature.value,
    picked: false,
    feature
  }));

  const selectedFeatures = await vscode.window.showQuickPick(featureItems, {
    canPickMany: true,
    placeHolder: "Select enterprise features to enable"
  });

  if (selectedFeatures && selectedFeatures.length > 0) {
    const enabledFeatures = selectedFeatures.map((item: any) => item.feature);
    await activateEnterpriseFeatures(org, enabledFeatures);
  }
}

async function activateEnterpriseFeatures(org: string, features: EnterpriseFeature[]): Promise<void> {
  // Store enterprise features in workspace configuration
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  await config.update('enterprise.enabled', true, vscode.ConfigurationTarget.Workspace);
  await config.update('enterprise.features', features.map(f => f.id), vscode.ConfigurationTarget.Workspace);
  await config.update('enterprise.organization', org, vscode.ConfigurationTarget.Workspace);

  const featureNames = features.map(f => f.name).join(', ');
  
  vscode.window.showInformationMessage(
    `✅ Successfully enabled enterprise features for ${org}: ${featureNames}`,
    "View Dashboard",
    "Configure Settings"
  ).then((choice: string | undefined) => {
    switch (choice) {
      case "View Dashboard":
        openEnterpriseDashboard();
        break;
      case "Configure Settings":
        vscode.commands.executeCommand('workbench.action.openSettings', 'orgOnboarding.enterprise');
        break;
    }
  });
}

function enableSpecificFeature(feature: EnterpriseFeature): void {
  vscode.window.showInformationMessage(
    `✅ Enabled: ${feature.name}\n\n${feature.description}`,
    "Configure",
    "View All Features"
  ).then((choice: string | undefined) => {
    if (choice === "Configure") {
      configureFeature(feature);
    } else if (choice === "View All Features") {
      showEnterpriseDetails();
    }
  });
}

function configureFeature(feature: EnterpriseFeature): void {
  switch (feature.id) {
    case 'centralized-audit-logs':
      configureAuditLogs();
      break;
    case 'security-dashboard':
      configureSecurityDashboard();
      break;
    case 'drift-monitoring':
      configureDriftMonitoring();
      break;
    default:
      vscode.window.showInformationMessage(
        `Configuration for ${feature.name} will be available in the next update.`
      );
  }
}

function configureAuditLogs(): void {
  vscode.window.showInputBox({
    prompt: "Enter audit log endpoint URL",
    placeHolder: "https://logs.yourorg.com/api/audit"
  }).then((url: string | undefined) => {
    if (url) {
      const config = vscode.workspace.getConfiguration('orgOnboarding');
      config.update('enterprise.auditLogs.endpoint', url, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage("✅ Audit logs configured successfully!");
    }
  });
}

function configureSecurityDashboard(): void {
  vscode.window.showInputBox({
    prompt: "Enter security dashboard URL",
    placeHolder: "https://security.yourorg.com/dashboard"
  }).then((url: string | undefined) => {
    if (url) {
      const config = vscode.workspace.getConfiguration('orgOnboarding');
      config.update('enterprise.security.dashboardUrl', url, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage("✅ Security dashboard configured successfully!");
    }
  });
}

function configureDriftMonitoring(): void {
  const options = ['Immediate', 'Daily', 'Weekly', 'Custom'];
  
  vscode.window.showQuickPick(options, {
    placeHolder: "Select drift monitoring frequency"
  }).then((frequency: string | undefined) => {
    if (frequency) {
      const config = vscode.workspace.getConfiguration('orgOnboarding');
      config.update('enterprise.drift.frequency', frequency, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`✅ Drift monitoring set to ${frequency}!`);
    }
  });
}

function contactSales(org?: string): void {
  const salesMessage = `**Contact Enterprise Sales**

Interested in enterprise features for ${org || 'your organization'}?

Our enterprise solutions include:
• Advanced security and compliance tools
• Centralized governance and reporting
• Custom integrations and support
• Dedicated customer success manager

We'll help you:
• Assess your organization's needs
• Design a custom implementation plan  
• Provide training and onboarding support
• Ensure successful adoption across teams`;

  vscode.window.showInformationMessage(
    salesMessage,
    "Schedule Demo",
    "Send Email",
    "Learn More"
  ).then((choice: string | undefined) => {
    switch (choice) {
      case "Schedule Demo":
        vscode.env.openExternal(vscode.Uri.parse('https://calendly.com/yourorg-enterprise'));
        break;
      case "Send Email":
        vscode.env.openExternal(vscode.Uri.parse('mailto:enterprise@yourorg.com?subject=Enterprise%20Features%20Inquiry'));
        break;
      case "Learn More":
        vscode.env.openExternal(vscode.Uri.parse('https://yourorg.com/enterprise'));
        break;
    }
  });
}

function openEnterpriseDashboard(): void {
  const config = vscode.workspace.getConfiguration('orgOnboarding');
  const dashboardUrl = config.get<string>('enterprise.security.dashboardUrl');
  
  if (dashboardUrl) {
    vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
  } else {
    vscode.window.showInformationMessage(
      "Enterprise dashboard not configured yet. Would you like to set it up?",
      "Configure Now"
    ).then((choice: string | undefined) => {
      if (choice === "Configure Now") {
        configureSecurityDashboard();
      }
    });
  }
}

export function getEnterpriseStatus(): {enabled: boolean, features: string[], organization?: string} {
  const config = vscode.workspace.getConfiguration('orgOnboarding.enterprise');
  return {
    enabled: config.get<boolean>('enabled', false),
    features: config.get<string[]>('features', []),
    organization: config.get<string>('organization')
  };
}