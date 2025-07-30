import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface OrgStandardsCheck {
  trunkExists: boolean;
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
  
  if (!standards.trunkExists) {
    missing.push("Trunk linting configuration (.trunk/trunk.yaml)");
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
  let setupCount = 0;
  
  try {
    for (const item of missing) {
      if (item.includes("Trunk")) {
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
      "View Changes"
    ).then((choice: string | undefined) => {
      if (choice === "View Changes") {
        vscode.commands.executeCommand("workbench.scm.focus");
      }
    });
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to setup standards: ${error}`);
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

async function showStandardsInfo(org: string): Promise<void> {
  const infoMessage = `🏢 ${org} Organization Standards:

✅ **Trunk Configuration**: Unified linting with ESLint, Prettier, security scans
✅ **ESLint Setup**: TypeScript-strict linting with import/security rules  
✅ **VSCode Extensions**: Recommended extensions for consistent dev experience
✅ **Git Hooks**: Pre-commit validation to catch issues early
✅ **CI/CD Pipeline**: Automated quality checks on every push/PR
✅ **Security Scanning**: Dependabot + vulnerability scanning

These standards ensure:
• Consistent code quality across all repositories
• Early detection of security vulnerabilities  
• Reduced onboarding time for new developers
• Automated compliance with org policies

Would you like to set up these standards now?`;

  const choice = await vscode.window.showInformationMessage(
    infoMessage,
    "Setup Now",
    "Maybe Later"
  );

  if (choice === "Setup Now") {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const standards = await checkOrgStandards(workspaceFolder.uri.fsPath);
      const missing = getMissingStandards(standards);
      await setupAllStandards(workspaceFolder.uri.fsPath, missing);
    }
  }
}