# Developer Onboarding: Unified Code Quality & Tooling

Welcome to the team! To ensure consistent code quality and developer experience, we use a unified setup across all repositories.

## 🚀 Quick Start (5 minutes)

### Step 1: Install the Org Onboarding Extension

**Option A: From VSIX file**

```bash
code --install-extension org-onboarding-1.0.0.vsix
```

**Option B: From internal marketplace**

1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Org Onboarding"
4. Click Install

### Step 2: Opt-in to Organization Standards

1. Open any workspace/repository in VSCode
2. You'll see a welcome prompt: "🏢 Welcome! Would you like to set up organization standards?"
3. Click **"Get Started"**
4. Follow the guided setup process

**Manual activation:**

- Open Command Palette (`Ctrl+Shift+P`)
- Run: `Org Onboarding: Opt-in to Org Standards`

### Step 3: Let the Magic Happen

The extension will automatically:

- ✅ Set up Trunk linting (`.trunk/trunk.yaml`)
- ✅ Configure ESLint (`eslint.config.js`)
- ✅ Recommend VSCode extensions (`.vscode/extensions.json`)
- ✅ Set up CI/CD pipeline (`.github/workflows/code-quality.yml`)
- ✅ Configure security scanning (Dependabot, OSV Scanner)

## 📋 What You Get

### Core Development Tools

- **Trunk**: Unified linting with ESLint, Prettier, security scans
- **ESLint**: TypeScript-strict rules with import/security validation
- **Prettier**: Consistent code formatting
- **VSCode Extensions**: Auto-sync of recommended extensions

### Quality & Security

- **Pre-commit hooks**: Catch issues before they hit the repo
- **CI/CD integration**: Automated checks on every push/PR
- **Security scanning**: Vulnerability detection with OSV Scanner
- **Dependency updates**: Automated via Dependabot

### Monitoring & Compliance

- **Trust signals**: Real-time compliance status in VSCode
- **Drift detection**: Alerts when your setup differs from org standards
- **Auto-remediation**: One-click fixes for common issues

## 🔧 Manual Commands

Access these via Command Palette (`Ctrl+Shift+P`):

| Command                                       | Description                            |
| --------------------------------------------- | -------------------------------------- |
| `Org Onboarding: Opt-in to Org Standards`     | Initial setup and onboarding           |
| `Org Onboarding: Show Trust Signals`          | View compliance status and trust level |
| `Org Onboarding: Detect and Fix Config Drift` | Check for and fix configuration drift  |
| `Org Onboarding: Sync VSCode Extensions`      | Install/update recommended extensions  |
| `Org Onboarding: Enterprise Value Suggest`    | Explore enterprise features            |

## 📊 Status Bar Integration

Look for the **"🛡️ Org Standards"** item in your status bar:

- **Green shield** (🛡️✅): Fully compliant
- **Yellow shield** (🛡️⚠️): Minor issues detected
- **Red shield** (🛡️❌): Action required

Click the shield to view detailed compliance status.

## 🏢 Organization Standards

### Required Files

After setup, your repository will have:

```
your-repo/
├── .trunk/
│   └── trunk.yaml           # Unified linting config
├── .vscode/
│   └── extensions.json      # Recommended extensions
├── .github/
│   ├── workflows/
│   │   └── code-quality.yml # CI/CD pipeline
│   └── dependabot.yml       # Security updates
├── eslint.config.js         # ESLint configuration
├── package.json             # Updated with lint scripts
└── tsconfig.json            # TypeScript configuration
```

### Recommended Extensions

The following extensions will be auto-installed:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **SonarLint** - Code quality analysis
- **Markdownlint** - Markdown style checking
- **Code Spell Checker** - Catch typos in code
- **Import Cost** - Display package import sizes

## 🔍 Troubleshooting

### Common Issues

**"Extension not activating"**

- Ensure VSCode 1.80+ is installed
- Open a workspace folder (not just loose files)
- Check Output panel for error messages

**"Trust signals showing red"**

- Run: `Org Onboarding: Detect and Fix Config Drift`
- Install missing extensions when prompted
- Commit any auto-generated configuration files

**"Linting not working"**

- Run: `npm install` to install linting dependencies
- Restart VSCode after configuration changes
- Check that `trunk check` runs successfully in terminal

**"CI/CD pipeline failing"**

- Ensure all required dependencies are in `package.json`
- Check that test scripts are properly configured
- Verify branch protection rules allow the pipeline

### Getting Help

1. **Quick fixes**: Use `Org Onboarding: Detect and Fix Config Drift`
2. **Team help**: Ask in #platform-engineering Slack channel
3. **Documentation**: Check this repo's README.md
4. **Issues**: Create GitHub issue with `help-wanted` label

## 🚀 Pro Tips

### Daily Workflow

1. **Before coding**: Glance at status bar for compliance
2. **During coding**: Let Trunk auto-fix issues as you type
3. **Before commit**: Trust the pre-commit hooks to catch issues
4. **After PR**: Check CI pipeline passes all quality gates

### Power User Features

- **Bulk setup**: Run onboarding on multiple repos using the config server
- **Custom rules**: Extend ESLint/Trunk configs for project-specific needs
- **Enterprise features**: Unlock advanced reporting and governance tools

### VSCode Settings

Optimize your experience with these settings:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact"
  ]
}
```

## 📈 What's Next?

### Immediate (First Week)

- [ ] Complete onboarding for your main repositories
- [ ] Get familiar with Trunk and ESLint configurations
- [ ] Set up GitHub token for CI/CD status integration
- [ ] Join #platform-engineering for updates and support

### Ongoing (First Month)

- [ ] Monitor and fix any drift alerts promptly
- [ ] Explore enterprise features if available for your team
- [ ] Provide feedback on the developer experience
- [ ] Help onboard other team members

### Advanced (Ongoing)

- [ ] Contribute to organization-wide standards and policies
- [ ] Customize configurations for specific project needs
- [ ] Participate in tooling discussions and improvements

## 🎯 Success Metrics

You'll know the onboarding is successful when:

- ✅ Status bar shows green shield consistently
- ✅ Pre-commit hooks prevent bad code from being committed
- ✅ CI/CD pipeline passes reliably on every PR
- ✅ Code reviews focus on logic, not style/formatting issues
- ✅ You spend more time coding, less time configuring tools

## 🔄 Staying Up to Date

The extension automatically:

- Updates configuration standards from the organization
- Syncs new recommended extensions
- Alerts you to new best practices and tools
- Provides upgrade paths for breaking changes

**Manual updates:**

- Update the extension when new versions are released
- Run drift detection weekly to catch any configuration changes
- Participate in organization-wide tooling updates

---

**Questions?** Reach out to the Platform Engineering team in #platform-engineering or email platform-team@yourorg.com

**Feedback?** We're always improving! Share your experience and suggestions for making developer onboarding even better.

Welcome to the team! 🎉
