# Org Onboarding VSCode Extension

A comprehensive VSCode extension for organization-aware onboarding, configuration drift detection, CI/CD alignment, and enterprise value delivery.

## Features

### 🏢 Organization-Aware Onboarding

- **Auto-detect organization context** from Git remotes
- **Smart setup suggestions** for missing standards and configurations
- **One-click setup** for Trunk, ESLint, extensions, and CI/CD
- **Guided onboarding flow** with progressive enhancement

### 🔒 Trust Signals & Validation

- **Real-time compliance monitoring** with visual status indicators
- **GitHub Actions integration** for CI/CD status tracking
- **Security scan integration** (OSV Scanner, Trunk security checks)
- **Extension health monitoring** and auto-sync capabilities

### 📊 Configuration Drift Detection

- **Intelligent drift detection** comparing local vs organization standards
- **Auto-fix capabilities** for common configuration issues
- **Selective remediation** - choose what to fix and when
- **Proactive alerts** before issues become problems

### 🚀 Enterprise Value Features

- **Centralized audit logging** for compliance and reporting
- **Developer productivity metrics** and insights
- **Policy as code enforcement** with automated governance
- **Enterprise integrations** (JIRA, ServiceNow, security tools)

## Quick Start

### Installation

1. **From VSIX** (recommended for testing):

   ```bash
   code --install-extension org-onboarding-1.0.0.vsix
   ```

2. **From Marketplace** (when published):
   ```bash
   ext install your-org.org-onboarding
   ```

### First Use

1. Open any workspace in VSCode
2. The extension will automatically prompt for onboarding
3. Click "Get Started" to opt-in to organization standards
4. Follow the guided setup process

### Manual Activation

Access commands via Command Palette (`Cmd/Ctrl+Shift+P`):

- `Org Onboarding: Opt-in to Org Standards`
- `Org Onboarding: Show Trust Signals`
- `Org Onboarding: Detect and Fix Config Drift`
- `Org Onboarding: Sync VSCode Extensions`
- `Org Onboarding: Enterprise Value Suggest`

## Configuration

### Extension Settings

Configure in VSCode settings (`settings.json`):

```json
{
  "orgOnboarding.optedIn": false,
  "orgOnboarding.organization": "your-org",
  "orgOnboarding.github.token": "ghp_your_token_here",
  "orgOnboarding.enterprise.enabled": false,
  "orgOnboarding.enterprise.features": [],
  "orgOnboarding.configServer.url": "https://config.yourorg.com"
}
```

### Organization Standards

The extension automatically sets up:

- **`.trunk/trunk.yaml`** - Unified linting configuration
- **`eslint.config.js`** - TypeScript-strict ESLint setup
- **`.vscode/extensions.json`** - Recommended extension list
- **`.github/workflows/code-quality.yml`** - CI/CD pipeline
- **`.github/dependabot.yml`** - Security dependency updates

## Development

### Prerequisites

- Node.js 18+
- VSCode 1.80+
- TypeScript 5.3+

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/org-onboarding-vscode-extension.git
cd org-onboarding-vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Package extension
npm run package
```

### Testing

```bash
# Run linting
npm run lint

# Type check
npm run type-check

# Watch mode for development
npm run watch
```

### VSCode Development

1. Open the project in VSCode
2. Press `F5` to launch Extension Development Host
3. Test commands in the new VSCode window
4. Make changes and reload (`Ctrl+R`) to test

## Architecture

### Core Components

```
src/
├── extension.ts              # Main entry point and command registration
├── orgConfigClient.ts        # Core onboarding and drift detection logic
├── githubActionsApi.ts       # GitHub API integration for CI/CD status
├── securityScanParser.ts     # Security scan result parsing (OSV, Trunk)
├── autoSyncExtensions.ts     # VSCode extension management
├── autoSuggestOrgSetup.ts    # Organization setup automation
└── enterpriseValueSuggest.ts # Enterprise feature suggestions
```

### Configuration Server (Optional)

Deploy `orgConfigServer.js` to provide centralized configuration:

```bash
# Install dependencies
npm install express

# Start server
node orgConfigServer.js

# Server runs on http://localhost:3001
# Serves configs from /configs directory
```

### Standard Configurations

Place organization standard configs in:

- `configs/trunk.yaml` - Trunk linting standards
- `configs/eslint.config.js` - ESLint standards
- `configs/extensions.json` - VSCode extensions list

## Enterprise Features

### Available Features

- **Centralized Audit Logs** - Track all activities for compliance
- **Standards Enforcement** - Automatically enforce org policies
- **Drift Monitoring** - Proactive alerts for configuration drift
- **Security Dashboard** - Unified vulnerability management
- **Developer Metrics** - Productivity and quality insights
- **Automated Remediation** - AI-powered issue resolution
- **Policy as Code** - Version-controlled governance rules
- **Enterprise APIs** - Integration with existing tools

### Activation

Enterprise features can be enabled via:

1. Command Palette: `Org Onboarding: Enterprise Value Suggest`
2. Status Bar: Click when trust level is high (70%+)
3. Settings: Configure `orgOnboarding.enterprise.*` options

## API Integration

### GitHub Actions

Set your GitHub token in settings:

```json
{
  "orgOnboarding.github.token": "ghp_your_personal_access_token"
}
```

Required permissions:

- `repo:status` - Read repository status
- `actions:read` - Read workflow runs

### Security Scanning

The extension parses results from:

- **OSV Scanner**: `osv-scanner --json`
- **Trunk Security**: `trunk check --output json`
- **Custom scanners**: Implement parser in `securityScanParser.ts`

## Deployment

### Internal Distribution

1. **Build and package**:

   ```bash
   npm run build
   npm run package
   ```

2. **Distribute VSIX file** to your organization
3. **Install instructions** for team members:
   ```bash
   code --install-extension org-onboarding-1.0.0.vsix
   ```

### Marketplace Publishing

1. **Get Publisher ID** from [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
2. **Update package.json** with your publisher ID
3. **Publish**:
   ```bash
   npx vsce login your-publisher-id
   npx vsce publish
   ```

## Troubleshooting

### Common Issues

**Extension not activating:**

- Check VSCode version compatibility (requires 1.80+)
- Verify workspace folder is open
- Check Output panel for error messages

**TypeScript compilation errors:**

- Run `npm install` to get all dependencies
- Ensure TypeScript 5.3+ is installed
- Check `tsconfig.json` configuration

**GitHub API errors:**

- Verify token has correct permissions
- Check token hasn't expired
- Ensure repository URL is accessible

**Configuration drift false positives:**

- Update org standards in `configs/` directory
- Clear extension cache via Command Palette
- Check file paths and naming conventions

### Debug Mode

Enable debug logging:

```json
{
  "orgOnboarding.debug": true
}
```

View logs in Output panel → "Org Onboarding"

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Commit with clear messages: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request with detailed description

### Code Standards

- Follow TypeScript strict mode
- Use ESLint configuration provided
- Add tests for new features
- Update documentation for changes
- Follow semantic versioning

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Internal Issues**: Contact your platform engineering team
- **Feature Requests**: Open GitHub issue with `enhancement` label
- **Bug Reports**: Open GitHub issue with `bug` label and reproduction steps
- **Enterprise Sales**: Contact enterprise@yourorg.com

## Roadmap

### v1.1 (Next)

- [ ] Advanced security scan integration
- [ ] Custom policy rule engine
- [ ] Team collaboration features
- [ ] Performance optimizations

### v1.2 (Future)

- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Automated dependency updates
- [ ] Integration with more CI/CD platforms

### Enterprise (Ongoing)

- [ ] SSO/SAML integration
- [ ] Advanced reporting and compliance
- [ ] Custom branding and theming
- [ ] Dedicated support and training

---

**Made with ❤️ by your Platform Engineering Team**

For questions or support, reach out to #platform-engineering or email platform-team@yourorg.com
