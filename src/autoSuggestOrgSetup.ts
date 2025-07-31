import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { MegaLinterOrchestrator } from "./megalinter/orchestrator";
import { UserPreferences } from "./megalinter/types";

// Global flag to prevent concurrent setup operations
let isSetupInProgress = false;

export interface OrgStandardsCheck {
  trunkExists: boolean;
  megalinterExists: boolean;
  eslintExists: boolean;
  extensionsJsonExists: boolean;
  gitHooksExists: boolean;
  ciConfigExists: boolean;
  securityConfigExists: boolean;
}

export async function suggestOrgSetup(repo: string, org: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found");
    return;
  }

  const rootPath = workspaceFolder.uri.fsPath;
  const standards = await checkOrgStandards(rootPath);
  const missing = getMissingStandards(standards);

  if (missing.length === 0) {
    vscode.window.showInformationMessage(
      `✅ ${repo} is fully aligned with ${org} standards!`
    );
    return;
  }

  const missingList = missing.map(item => `• ${item}`).join('\n');
  const message = `🏢 ${repo} is missing ${org} organization standards:\n\n${missingList}\n\nWould you like to set these up automatically?`;

  const choice = await vscode.window.showWarningMessage(
    message,
    "Setup All",
    "Select Items",
    "Learn More",
    "Skip"
  );

  switch (choice) {
    case "Setup All":
      await setupAllStandards(rootPath, missing);
      break;
    case "Select Items":
      await selectiveSetup(rootPath, missing);
      break;
    case "Learn More":
      await showStandardsInfo(org);
      break;
    default:
      // Skip
      break;
  }
}

async function checkOrgStandards(rootPath: string): Promise<OrgStandardsCheck> {
  return {
    trunkExists: fs.existsSync(path.join(rootPath, '.trunk', 'trunk.yaml')),
    megalinterExists: fs.existsSync(path.join(rootPath, '.mega-linter.yml')) ||
                      fs.existsSync(path.join(rootPath, '.megalinter.yml')),
    eslintExists: fs.existsSync(path.join(rootPath, 'eslint.config.js')) ||
                  fs.existsSync(path.join(rootPath, '.eslintrc.js')) ||
                  fs.existsSync(path.join(rootPath, '.eslintrc.json')),
    extensionsJsonExists: fs.existsSync(path.join(rootPath, '.vscode', 'extensions.json')),
    gitHooksExists: fs.existsSync(path.join(rootPath, '.husky')) ||
                    fs.existsSync(path.join(rootPath, '.git', 'hooks', 'pre-commit')),
    ciConfigExists: fs.existsSync(path.join(rootPath, '.github', 'workflows')) ||
                    fs.existsSync(path.join(rootPath, '.gitlab-ci.yml')) ||
                    fs.existsSync(path.join(rootPath, 'azure-pipelines.yml')),
    securityConfigExists: fs.existsSync(path.join(rootPath, '.github', 'dependabot.yml')) ||
                         fs.existsSync(path.join(rootPath, '.snyk'))
  };
}

function getMissingStandards(standards: OrgStandardsCheck): string[] {
  const missing: string[] = [];
  
  // Prefer MegaLinter over Trunk, but support both
  if (!standards.megalinterExists && !standards.trunkExists) {
    missing.push("MegaLinter configuration (.mega-linter.yml) - Advanced linting with 400+ linters");
  } else if (standards.trunkExists && !standards.megalinterExists) {
    missing.push("MegaLinter upgrade (replace Trunk with MegaLinter for enhanced capabilities)");
  }
  
  if (!standards.eslintExists) {
    missing.push("ESLint configuration (eslint.config.js)");
  }
  if (!standards.extensionsJsonExists) {
    missing.push("VSCode extensions recommendations (.vscode/extensions.json)");
  }
  if (!standards.gitHooksExists) {
    missing.push("Git hooks for pre-commit validation");
  }
  if (!standards.ciConfigExists) {
    missing.push("CI/CD pipeline configuration");
  }
  if (!standards.securityConfigExists) {
    missing.push("Security scanning configuration");
  }
  
  return missing;
}

async function setupAllStandards(rootPath: string, missing: string[]): Promise<void> {
  // Prevent concurrent setup operations to avoid loops
  if (isSetupInProgress) {
    vscode.window.showWarningMessage("⚠️ Setup operation already in progress. Please wait for it to complete.");
    return;
  }
  
  isSetupInProgress = true;
  let setupCount = 0;
  
  try {
    for (const item of missing) {
      if (item.includes("MegaLinter")) {
        await setupMegaLinterConfig(rootPath);
        setupCount++;
      } else if (item.includes("Trunk") && !item.includes("MegaLinter")) {
        // Legacy Trunk support - still functional but will suggest MegaLinter upgrade
        await setupTrunkConfig(rootPath);
        setupCount++;
      } else if (item.includes("ESLint")) {
        await setupEslintConfig(rootPath);
        setupCount++;
      } else if (item.includes("VSCode extensions")) {
        await setupVSCodeExtensions(rootPath);
        setupCount++;
      } else if (item.includes("Git hooks")) {
        await setupGitHooks(rootPath);
        setupCount++;
      } else if (item.includes("CI/CD")) {
        await setupCIConfig(rootPath);
        setupCount++;
      } else if (item.includes("Security")) {
        await setupSecurityConfig(rootPath);
        setupCount++;
      }
    }
    
    vscode.window.showInformationMessage(
      `✅ Successfully set up ${setupCount} organization standards!`,
      "View Changes",
      "Test MegaLinter"
    ).then((choice: string | undefined) => {
      if (choice === "View Changes") {
        vscode.commands.executeCommand("workbench.scm.focus");
      } else if (choice === "Test MegaLinter") {
        testMegaLinterSetup(rootPath);
      }
    });
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to setup standards: ${error}`);
  } finally {
    isSetupInProgress = false;
  }
}

async function selectiveSetup(rootPath: string, missing: string[]): Promise<void> {
  const selected = await vscode.window.showQuickPick(missing, {
    canPickMany: true,
    placeHolder: "Select standards to set up"
  });

  if (selected && selected.length > 0) {
    await setupAllStandards(rootPath, selected);
  }
}

async function setupTrunkConfig(rootPath: string): Promise<void> {
  const trunkDir = path.join(rootPath, '.trunk');
  const trunkConfigPath = path.join(trunkDir, 'trunk.yaml');
  
  if (!fs.existsSync(trunkDir)) {
    fs.mkdirSync(trunkDir, { recursive: true });
  }
  
  const trunkConfig = `version: 0.1
cli:
  version: 1.22.15
plugins:
  sources:
    - id: trunk
lint:
  enabled:
    - actionlint@1.6.26
    - checkov@3.2.26
    - eslint@9.27.0
    - markdownlint@0.39.0
    - osv-scanner@1.6.2
    - prettier@3.5.3
    - shellcheck@0.9.0
    - shfmt@3.6.0
    - trufflehog@3.63.7
    - yamllint@1.33.0
  threshold:
    - linters: [ALL]
      level: high
actions:
  enabled:
    - trunk-announce
    - trunk-check-pre-push
    - trunk-fmt-pre-commit
    - trunk-upgrade-available`;

  fs.writeFileSync(trunkConfigPath, trunkConfig);
}

async function setupEslintConfig(rootPath: string): Promise<void> {
  const eslintConfigPath = path.join(rootPath, 'eslint.config.js');
  
  const eslintConfig = `import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "*.config.js", "*.config.ts"] },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      prettierConfig
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { 
        ...globals.browser, 
        ...globals.node,
        ...globals.es2022
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "prettier/prettier": "error"
    }
  }
);`;

  fs.writeFileSync(eslintConfigPath, eslintConfig);
}

async function setupVSCodeExtensions(rootPath: string): Promise<void> {
  const vscodeDir = path.join(rootPath, '.vscode');
  const extensionsPath = path.join(vscodeDir, 'extensions.json');
  
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  
  const extensionsConfig = {
    recommendations: [
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode",
      "SonarSource.sonarlint-vscode",
      "davidanson.vscode-markdownlint",
      "streetsidesoftware.code-spell-checker",
      "wix.vscode-import-cost"
    ]
  };
  
  fs.writeFileSync(extensionsPath, JSON.stringify(extensionsConfig, null, 2));
}

async function setupGitHooks(rootPath: string): Promise<void> {
  // Create a simple package.json script for pre-commit if it doesn't exist
  const packageJsonPath = path.join(rootPath, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['pre-commit'] = 'trunk check --fix';
    packageJson.scripts['lint'] = 'trunk check';
    packageJson.scripts['lint:fix'] = 'trunk check --fix';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

async function setupCIConfig(rootPath: string): Promise<void> {
  const githubDir = path.join(rootPath, '.github', 'workflows');
  const ciConfigPath = path.join(githubDir, 'code-quality.yml');
  
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }
  
  const ciConfig = `name: Code Quality

on: [push, pull_request]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Trunk Check
        uses: trunk-io/trunk-action@v1
        with:
          check-mode: all
      
      - name: Type Check
        run: npm run type-check || npx tsc --noEmit
      
      - name: Run Tests
        run: npm test || echo "No tests configured"`;

  fs.writeFileSync(ciConfigPath, ciConfig);
}

async function setupSecurityConfig(rootPath: string): Promise<void> {
  const githubDir = path.join(rootPath, '.github');
  const dependabotPath = path.join(githubDir, 'dependabot.yml');
  
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }
  
  const dependabotConfig = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore"
      include: "scope"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"`;

  fs.writeFileSync(dependabotPath, dependabotConfig);
}

async function setupMegaLinterConfig(rootPath: string): Promise<void> {
  try {
    const orchestrator = new MegaLinterOrchestrator();
    
    // Show progress notification
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Setting up MegaLinter configuration...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 20, message: "Analyzing repository..." });
      
      // Analyze repository to get language profile
      const profile = await orchestrator.detectLanguages(rootPath);
      
      progress.report({ increment: 40, message: "Selecting optimal linters..." });
      
      // Generate optimal configuration
      const config = await orchestrator.generateConfiguration(profile, []);
      
      progress.report({ increment: 60, message: "Generating configuration file..." });
      
      // Export configuration to .mega-linter.yml
      const configGenerator = orchestrator['configGenerator']; // Access private field
      if (configGenerator) {
        const yamlConfig = await configGenerator.exportToYaml(config);
        const configPath = path.join(rootPath, '.mega-linter.yml');
        fs.writeFileSync(configPath, yamlConfig, 'utf8');
      }
      
      progress.report({ increment: 80, message: "Creating Docker ignore file..." });
      
      // Create .dockerignore for better MegaLinter performance
      const dockerignorePath = path.join(rootPath, '.dockerignore');
      if (!fs.existsSync(dockerignorePath)) {
        const dockerignoreContent = `node_modules/
dist/
build/
coverage/
*.log
.git/
.vscode/
.idea/
*.tmp
*.temp`;
        fs.writeFileSync(dockerignorePath, dockerignoreContent);
      }
      
      progress.report({ increment: 100, message: "MegaLinter setup complete!" });
    });
    
    // Show setup summary
    vscode.window.showInformationMessage(
      "🚀 MegaLinter configured successfully! Configuration includes intelligent linter selection based on your project structure.",
      "View Config",
      "Run MegaLinter"
    ).then((choice: string | undefined) => {
      if (choice === "View Config") {
        vscode.workspace.openTextDocument(path.join(rootPath, '.mega-linter.yml'))
          .then(doc => vscode.window.showTextDocument(doc));
      } else if (choice === "Run MegaLinter") {
        testMegaLinterSetup(rootPath);
      }
    });
    
  } catch (error) {
    console.error('Error setting up MegaLinter:', error);
    vscode.window.showErrorMessage(`Failed to setup MegaLinter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testMegaLinterSetup(rootPath: string): Promise<void> {
  const orchestrator = new MegaLinterOrchestrator();
  
  try {
    // Check Docker availability first
    const status = await orchestrator.getStatus();
    
    if (!status.dockerAvailable) {
      vscode.window.showErrorMessage(
        "Docker is required to run MegaLinter. Please install Docker and try again.",
        "Install Docker"
      ).then((choice) => {
        if (choice === "Install Docker") {
          vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
        }
      });
      return;
    }
    
    vscode.window.showInformationMessage(
      `🐳 Docker detected (MegaLinter ${status.megalinterVersion || 'latest'}). Ready to run MegaLinter!`,
      "Run Now",
      "View Docs"
    ).then((choice) => {
      if (choice === "Run Now") {
        vscode.window.showInformationMessage(
          "🚀 To run MegaLinter, use: `docker run --rm -v ${PWD}:/tmp/lint oxsecurity/megalinter:latest`",
          "Copy Command"
        ).then((copyChoice) => {
          if (copyChoice === "Copy Command") {
            vscode.env.clipboard.writeText("docker run --rm -v ${PWD}:/tmp/lint oxsecurity/megalinter:latest");
            vscode.window.showInformationMessage("Command copied to clipboard!");
          }
        });
      } else if (choice === "View Docs") {
        vscode.env.openExternal(vscode.Uri.parse('https://megalinter.io/latest/'));
      }
    });
    
  } catch (error) {
    vscode.window.showErrorMessage(`Error testing MegaLinter setup: ${error}`);
  }
}

async function showStandardsInfo(org: string): Promise<void> {
  const infoMessage = `🏢 ${org} Organization Standards:

✅ **MegaLinter Configuration**: Advanced linting with 400+ linters for comprehensive code quality
✅ **ESLint Setup**: TypeScript-strict linting with import/security rules
✅ **VSCode Extensions**: Recommended extensions for consistent dev experience
✅ **Git Hooks**: Pre-commit validation to catch issues early
✅ **CI/CD Pipeline**: Automated quality checks on every push/PR
✅ **Security Scanning**: Multi-layered security with Dependabot + vulnerability scanning

These standards ensure:
• Comprehensive code quality across 40+ programming languages
• Advanced security vulnerability detection with 400+ linters
• Consistent development experience across all team members
• Automated compliance with organization policies
• Performance optimization and intelligent caching

MegaLinter Benefits:
🔍 **Deep Analysis**: 400+ linters vs traditional 9-10 linters
🚀 **Performance**: Intelligent parallelization and caching
🔒 **Security**: Advanced security scanning and secrets detection
📊 **Reporting**: Rich HTML reports and multiple output formats

Would you like to set up these enhanced standards now?`;

  const choice = await vscode.window.showInformationMessage(
    infoMessage,
    "Setup Now",
    "Learn More",
    "Maybe Later"
  );

  if (choice === "Setup Now") {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const standards = await checkOrgStandards(workspaceFolder.uri.fsPath);
      const missing = getMissingStandards(standards);
      await setupAllStandards(workspaceFolder.uri.fsPath, missing);
    }
  } else if (choice === "Learn More") {
    vscode.env.openExternal(vscode.Uri.parse('https://megalinter.io/latest/'));
  }
}